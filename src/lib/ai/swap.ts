import "server-only";
import { getCity } from "../cities";
import { distanceKm } from "../geo";
import { findPlaceByName, normalizeName } from "../places/match";
import { cachedRatings } from "../places/ratings";
import type { Place, PlaceCategory } from "../places/types";
import { extractJson } from "./plan";
import { linkItem } from "./placeLinks";
import { candidateLabel, rankedPlaces, type RatingsById } from "./prompt";
import { AiError, type AiProvider } from "./provider";
import { lenientArray, PlanItem, type SwapOption, type SwapRequest, type SwapResult } from "./schema";
import { z } from "zod";

export const SWAP_OPTIONS = 3;
export const SWAP_TIMEOUT_MS = 30_000;

const CATEGORIES: Record<PlanItem["kind"], PlaceCategory[]> = {
  eat: ["eat"],
  drink: ["drink", "eat"],
  see: ["see", "do"],
  do: ["do", "see"],
  free: ["see", "do", "buy"],
  stay: ["sleep"],
  travel: [],
};

const SwapReply = z.object({
  options: lenientArray(PlanItem.pick({ title: true, kind: true, placeName: true, note: true }), 6),
});

const norm = (s: string | undefined) => normalizeName(s ?? "");

/** Where the day is happening: the item's own place, else the middle of the day's other named places. */
function anchorFor(r: SwapRequest, places: Place[]): { lat: number; lon: number } | null {
  const own = findPlaceByName(places, r.item.placeName);
  if (own?.lat !== undefined && own.lon !== undefined) return { lat: own.lat, lon: own.lon };
  const pts = r.dayItems
    .map((it) => findPlaceByName(places, it.placeName))
    .filter((p): p is Place => !!p && p.lat !== undefined && p.lon !== undefined);
  if (!pts.length) return null;
  return { lat: pts.reduce((a, p) => a + p.lat!, 0) / pts.length, lon: pts.reduce((a, p) => a + p.lon!, 0) / pts.length };
}

export interface SwapCandidate {
  place: Place;
  km?: number;
}

/** Guide places that could replace the item: right kind, not already planned, nearby first among the best. */
export function swapCandidates(r: SwapRequest, places: Place[], ratings: RatingsById = {}, limit = 14): SwapCandidate[] {
  const used = new Set([...r.used, ...r.dayItems.map((d) => d.placeName ?? ""), r.item.placeName ?? ""].map(norm).filter(Boolean));
  const anchor = anchorFor(r, places);
  const out: SwapCandidate[] = [];
  CATEGORIES[r.item.kind].forEach((cat, ci) => {
    const pool = rankedPlaces(places, cat, ratings).filter((p) => !used.has(norm(p.name)));
    // The first category is the main one; later ones top it up.
    const best = pool.slice(0, ci === 0 ? 24 : 8);
    for (const p of best) {
      const km = anchor && p.lat !== undefined && p.lon !== undefined ? distanceKm(anchor, { lat: p.lat, lon: p.lon }) : undefined;
      out.push({ place: p, km });
    }
  });
  if (anchor) out.sort((a, b) => (a.km ?? 99) - (b.km ?? 99));
  return out.slice(0, limit);
}

const kmLabel = (km: number | undefined) => (km === undefined ? "" : km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m away` : `${km.toFixed(1)} km away`);

export function buildSwapPrompt(r: SwapRequest, candidates: SwapCandidate[], ratings: RatingsById = {}): { system: string; user: string } {
  const city = getCity(r.city);
  const system = `You are the concierge for Intercontinental Nomad, a refined trip planner for travellers from the United States.
Write like a knowledgeable luxury travel editor: warm, precise, never breathless. Plain English, short sentences.

The traveller wants to swap ONE item in their day plan for something different. Respond with ONE JSON object only, matching this shape exactly:
{ "options": [ { "title": string (max 10 words), "kind": "see"|"do"|"eat"|"drink"|"stay"|"travel"|"free", "placeName"?: string, "note"?: string (1-2 short sentences: why it suits this day) } ] }

Rules:
- Give exactly ${SWAP_OPTIONS} different options, best first. Keep the same kind as the item being replaced (a dinner stays a dinner; a sight is replaced by a sight nearby).
- Each option should be a specific place from the candidate list whenever one fits: put its exact name, copied character for character, in "placeName" and use it in the title. Where ratings (★) are shown, prefer higher-rated places.
- Never suggest a place named in "Already in the plan". Never invent a business name; if nothing in the list fits, describe the option generically with no "placeName".
- Keep to the same part of ${city.name} as the rest of the day where you can, and match the traveller's tastes.`;
  const user = `Traveller request: ${r.request.trim() || "(none given)"}
Preferences: ${r.preferences.join(", ") || "(none chosen)"}

City: ${city.name} (${r.city}). Day: ${r.date}${r.dayTitle ? ` - ${r.dayTitle}` : ""}
The rest of this day:
${r.dayItems.map((d) => `  ${d.time || "-"}: ${d.title} (${d.kind})`).join("\n") || "  (nothing else)"}

Replace this item: ${r.item.time || "-"}: ${r.item.title} (${r.item.kind})${r.item.note ? ` - ${r.item.note}` : ""}

Already in the plan (do not repeat): ${[...new Set([...r.used, r.item.placeName ?? ""])].filter(Boolean).join("; ") || "(nothing yet)"}
Traveller's saved places in ${city.name}: ${r.saved.join("; ") || "(none)"}

Candidate places in ${city.name} from the travel guide (★ = Google rating and number of reviews, when known):
${candidates.map((c) => `  ${candidateLabel(c.place, ratings)}${c.km !== undefined ? ` - ${kmLabel(c.km)}` : ""}`).join("\n") || "  (no guide listings available)"}`;
  return { system, user };
}

/** Add the server's remembered rating (no lookups) and the guide's exact place name to each option. */
function finish(options: SwapOption[], places: Place[], ratings: RatingsById, r: SwapRequest): SwapOption[] {
  const used = new Set([...r.used, r.item.placeName ?? "", ...r.dayItems.map((d) => d.placeName ?? "")].map(norm).filter(Boolean));
  const seen = new Set<string>();
  const out: SwapOption[] = [];
  for (const o of options) {
    const linked = linkItem({ time: "", title: o.title, kind: o.kind, placeName: o.placeName, note: o.note }, places);
    const key = norm(linked.placeName) || norm(linked.title);
    if (!key || seen.has(key) || used.has(norm(linked.placeName))) continue;
    if (norm(linked.title) === norm(r.item.title)) continue;
    seen.add(key);
    const hit = findPlaceByName(places, linked.placeName);
    const rt = hit ? ratings[hit.id] : undefined;
    out.push({
      title: linked.title,
      kind: linked.kind,
      ...(linked.placeName ? { placeName: linked.placeName } : {}),
      ...(linked.note ? { note: linked.note } : {}),
      ...(rt && rt.rating !== undefined ? { rating: { rating: rt.rating, ...(rt.count !== undefined ? { count: rt.count } : {}) } } : {}),
    });
    if (out.length === SWAP_OPTIONS) break;
  }
  return out;
}

export interface SwapOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Ask the AI for alternatives to one item. Retries once if the reply can't be used. */
export async function swapItem(r: SwapRequest, provider: AiProvider | null, places: Place[], opts: SwapOptions = {}): Promise<SwapResult> {
  const ratings: RatingsById = cachedRatings(r.city, places);
  const candidates = swapCandidates(r, places, ratings);

  if (!provider) {
    // No AI key: offer the best matching guide listings so the feature still works.
    const options = finish(
      candidates.map((c) => ({
        title: r.item.kind === "eat" ? `Dinner at ${c.place.name}` : c.place.name,
        kind: r.item.kind,
        placeName: c.place.name,
        ...(c.place.description ? { note: c.place.description.length > 140 ? `${c.place.description.slice(0, 137).trimEnd()}…` : c.place.description } : {}),
      })),
      places,
      ratings,
      r,
    );
    if (!options.length) throw new AiError("There are no other guide listings to suggest here. Add a Gemini key for more ideas.", 404, "empty");
    return { source: "sample", options, notice: "Suggestions from the city guide. Add a Gemini key for ideas tailored to your day." };
  }

  const prompt = buildSwapPrompt(r, candidates, ratings);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt ? `\n\nYour previous reply could not be used (${lastError}). Reply again with valid JSON matching the shape exactly.` : "";
    const res = await provider.generateJson(prompt.system, prompt.user + extra, { signal: opts.signal, timeoutMs: opts.timeoutMs ?? SWAP_TIMEOUT_MS });
    try {
      const parsed = SwapReply.safeParse(extractJson(res.text));
      if (!parsed.success) {
        lastError = "it did not match the expected shape";
        continue;
      }
      const options = finish(parsed.data.options, places, ratings, r);
      if (options.length) return { source: "gemini", options, model: res.model };
      lastError = "it had no new options";
    } catch (e) {
      lastError = e instanceof Error ? e.message.slice(0, 200) : "invalid JSON";
    }
  }
  throw new AiError(`The AI reply didn't match the expected format (${lastError}). Try again.`, 502, "empty");
}
