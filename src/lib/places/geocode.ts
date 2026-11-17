import "server-only";
import { customPlaceCode, type CustomPlace } from "../cities";

/**
 * Find any place by name with OpenStreetMap's Nominatim: a national forest, a lake,
 * a mountain town, a beach. Free with no key; the usage policy asks for an identifying
 * User-Agent, at most one request a second, caching, and no search-as-you-type, so the
 * app only searches when the traveller asks (Enter or the "Search everywhere" row).
 * Docs: https://nominatim.org/release-docs/latest/api/Search/
 */

const HEADERS = { "User-Agent": "IntercontinentalNomad/0.2 (personal trip planner; https://github.com/ikiyanitsyn/New-Repo)" };
const TTL_MS = 7 * 24 * 3600_000;
const cache = new Map<string, { at: number; value: CustomPlace[] }>();
let lastCall = 0;

interface NominatimHit {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  addresstype?: string;
  importance?: number;
  address?: Record<string, string>;
  namedetails?: Record<string, string>;
}

const KIND: Record<string, string> = {
  protected_area: "protected area", national_park: "national park", nature_reserve: "nature reserve", forest: "forest",
  city: "city", town: "town", village: "village", hamlet: "village", suburb: "neighbourhood", neighbourhood: "neighbourhood",
  island: "island", lake: "lake", water: "lake", reservoir: "lake", beach: "beach", peak: "mountain", mountain_range: "mountains",
  ski: "ski area", winter_sports: "ski area", valley: "valley", bay: "bay", county: "county", state: "region", region: "region",
};

/** A friendlier kind: "national forest" for Sierra National Forest, else OpenStreetMap's type. */
function kindOf(h: NominatimHit, name: string): string | undefined {
  const fromName = name.match(/\b(National Forest|National Park|State Park|National Monument|Wilderness|Lake|Beach|Island|Valley)\b/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  return KIND[h.type ?? ""] ?? KIND[h.addresstype ?? ""] ?? h.type?.replace(/_/g, " ");
}

export function mapHit(h: NominatimHit): CustomPlace | null {
  const lat = Number(h.lat);
  const lon = Number(h.lon);
  const name = (h.namedetails?.["name:en"] ?? h.name ?? h.display_name.split(",")[0] ?? "").trim();
  const cc = h.address?.country_code?.toUpperCase();
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || !cc || cc.length !== 2) return null;
  const a = h.address ?? {};
  const area = a.state ?? a.province ?? a.region ?? a.county ?? a.state_district;
  return {
    code: customPlaceCode(name, lat, lon),
    name: name.slice(0, 80),
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    country: cc,
    countryName: (a.country ?? cc).slice(0, 60),
    ...(area && area !== name ? { area: area.slice(0, 60) } : {}),
    ...(kindOf(h, name) ? { kind: kindOf(h, name)!.slice(0, 40) } : {}),
  };
}

export async function geocode(query: string, fetchImpl: typeof fetch = fetch): Promise<CustomPlace[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  // One request a second, as the usage policy asks.
  const wait = lastCall + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const params = new URLSearchParams({ q, format: "jsonv2", limit: "8", addressdetails: "1", namedetails: "1", "accept-language": "en" });
  const res = await fetchImpl(`https://nominatim.openstreetmap.org/search?${params}`, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Place search responded ${res.status}`);
  const hits = (await res.json()) as NominatimHit[];
  const seen = new Set<string>();
  const value: CustomPlace[] = [];
  for (const h of hits.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))) {
    const p = mapHit(h);
    if (!p) continue;
    const k = `${p.name}|${p.area ?? ""}|${p.country}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    value.push(p);
    if (value.length >= 6) break;
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}
