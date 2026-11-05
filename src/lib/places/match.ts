import { distanceKm } from "../geo";
import type { Place } from "./types";

/**
 * Name matching for guide listings: used to find a place from a link
 * ("Open Da Dong in the guide") and to pair a guide listing with the same
 * place at a ratings provider.
 */

/** Lower-case, no accents or punctuation, "&" read as "and". */
export function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Words that say what a place is rather than which place it is. */
const GENERIC = new Set([
  "the", "a", "an", "and", "of", "at", "in", "on", "de", "la", "le", "el",
  "hotel", "hotels", "hostel", "inn", "resort", "suites", "restaurant", "restaurants", "cafe", "bar", "pub",
  "museum", "temple", "park", "garden", "gardens", "market", "shop", "store", "branch",
]);

const tokens = (s: string, extraGeneric: Set<string>) =>
  normalizeName(s).split(" ").filter((t) => t && !GENERIC.has(t) && !extraGeneric.has(t));

/**
 * How alike two place names are, from 0 to 1.
 * 1: same after normalising. 0.9: one contains the other ("Da Dong" in "Da Dong Roast Duck").
 * Otherwise the share of distinctive words they have in common.
 * Words in `ignore` (usually the city's name) don't count as distinctive.
 */
export function nameSimilarity(a: string, b: string, ignore: string[] = []): number {
  const na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.replace(/ /g, "") === nb.replace(/ /g, "")) return 1;
  // One name inside the other, as whole words (or any run of Chinese/Japanese characters).
  // Only for names long enough to be distinctive.
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  const wordInside = ` ${long} `.includes(` ${short} `);
  const cjkInside = /[^\x00-\x7f]/.test(short) && long.replace(/ /g, "").includes(short.replace(/ /g, ""));
  if ((wordInside && short.replace(/ /g, "").length >= 4) || (cjkInside && short.length >= 2)) return 0.9;
  const extra = new Set(ignore.flatMap((w) => normalizeName(w).split(" ")).filter(Boolean));
  const ta = new Set(tokens(a, extra)), tb = new Set(tokens(b, extra));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

export interface Candidate {
  name: string;
  lat?: number;
  lon?: number;
}

export interface MatchOptions {
  /** City centre, used when the guide listing has no coordinates. */
  cityCentre: { lat: number; lon: number };
  /** Words to ignore when comparing names, e.g. ["Beijing"]. */
  ignore?: string[];
  /** How far apart the guide's pin and the provider's pin may be. */
  maxMetres?: number;
  /** How far from the city centre a provider place may be when the listing has no pin. */
  cityRadiusKm?: number;
}

export const MATCH_METRES = 300;

/**
 * The provider place that is the same as this guide listing, or undefined.
 * Rules, strictest first:
 *  - names alike (similarity >= 0.6) and pins within about 300 m;
 *  - names the same (similarity >= 0.9) and pins within 3x that, as guide pins are sometimes a block off;
 *  - listing has no pin: names the same (>= 0.9) and the provider place is in the city.
 */
export function matchCandidate<C extends Candidate>(place: Pick<Place, "name" | "alt" | "lat" | "lon">, candidates: C[], opts: MatchOptions): C | undefined {
  const maxM = opts.maxMetres ?? MATCH_METRES;
  const radius = opts.cityRadiusKm ?? 60;
  let best: { c: C; score: number; metres: number } | undefined;
  for (const c of candidates) {
    const sim = Math.max(nameSimilarity(place.name, c.name, opts.ignore), place.alt ? nameSimilarity(place.alt, c.name, opts.ignore) : 0);
    if (sim < 0.6) continue;
    const hasPin = place.lat !== undefined && place.lon !== undefined;
    const hasCand = c.lat !== undefined && c.lon !== undefined;
    let metres = Infinity;
    let ok = false;
    if (hasPin && hasCand) {
      metres = distanceKm({ lat: place.lat!, lon: place.lon! }, { lat: c.lat!, lon: c.lon! }) * 1000;
      ok = metres <= maxM || (sim >= 0.9 && metres <= maxM * 3);
    } else if (hasCand) {
      metres = distanceKm(opts.cityCentre, { lat: c.lat!, lon: c.lon! }) * 1000;
      ok = sim >= 0.9 && metres <= radius * 1000;
    } else {
      ok = sim >= 0.9;
    }
    if (!ok) continue;
    if (!best || sim > best.score || (sim === best.score && metres < best.metres)) best = { c, score: sim, metres };
  }
  return best?.c;
}

/**
 * Find a guide listing from a name in a link or a chat message.
 * Tries, in order: exact name, exact alternative name (often the local-script
 * name), then a loose match where one name contains the other. Ties go to the
 * shorter name, which is usually the main listing rather than a branch.
 */
export function findPlaceByName<P extends Pick<Place, "name" | "alt">>(places: P[], name: string | undefined | null): P | undefined {
  const q = normalizeName(name ?? "");
  if (!q) return undefined;
  const exact = places.find((p) => normalizeName(p.name) === q);
  if (exact) return exact;
  const alt = places.find((p) => p.alt && normalizeName(p.alt) === q);
  if (alt) return alt;
  const qc = q.replace(/ /g, "");
  if (qc.length < 3) return undefined;
  const loose = places
    .map((p) => {
      const names = [p.name, p.alt].filter((n): n is string => !!n).map((n) => normalizeName(n).replace(/ /g, ""));
      const hit = names.find((n) => n.length >= 3 && (n.includes(qc) || qc.includes(n)));
      return hit ? { p, len: Math.abs(hit.length - qc.length) } : null;
    })
    .filter((x): x is { p: P; len: number } => !!x)
    .sort((a, b) => a.len - b.len);
  return loose[0]?.p;
}
