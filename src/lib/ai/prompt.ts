import { STOPOVER_PROGRAMMES } from "../stopovers";
import { CITIES, findCity, getCity } from "../cities";
import { addDays, stopsWithDates, type Trip } from "../trip";
import { CATEGORY_LABEL, type Place, type PlaceCategory, type PlaceRating } from "../places/types";
import { featureScore, subcategoryOf } from "../places/subcategory";
import type { PlanRequest } from "./schema";

export interface DaySlot { date: string; city: string; note: string }

/** A run of consecutive day slots written by one AI call. `start` is the 0-based index of the first slot. */
export interface SlotChunk {
  start: number;
  slots: DaySlot[];
  city: string;
  /** Which part of this city's stay this is (0-based) and how many parts the city has. */
  part: number;
  parts: number;
}

/** Most days one AI call writes. Smaller replies come back faster and fail less. */
export const MAX_DAYS_PER_CHUNK = 5;

/** Build a Trip-shaped object from the request so dates match the planner exactly. */
export function requestTrip(r: PlanRequest): Trip {
  return {
    version: 1,
    title: "",
    home: r.trip.home,
    departDate: r.trip.departDate,
    returnHome: r.trip.returnHome,
    adults: r.trip.adults,
    cabin: "economy",
    stops: r.trip.stops.map((s, i) => ({ id: `s${i}`, city: s.city, nights: s.nights, ...(s.stopover ? { stopover: true } : {}) })),
    legModes: {},
  };
}

/** One slot per calendar day, from arrival in the first city to the final departure. */
export function daySlots(r: PlanRequest): DaySlot[] {
  const stops = stopsWithDates(requestTrip(r));
  const out: DaySlot[] = [];
  stops.forEach((s, i) => {
    for (let d = 0; d < s.nights; d++) {
      const date = addDays(s.arrive, d);
      let note = "";
      if (d === 0) note = i === 0 ? `arrive from ${getCity(r.trip.home).name} (long-haul flight; keep it light)` : `travel from ${stops[i - 1].cityInfo.name} by ${r.trip.modes[i - 1] ?? "train"}, then explore`;
      out.push({ date, city: s.city, note });
    }
  });
  const last = stops[stops.length - 1];
  if (last) out.push({ date: last.depart, city: last.city, note: r.trip.returnHome ? `fly home to ${getCity(r.trip.home).name}` : "departure day" });
  return out;
}

/**
 * Split the day slots into chunks of at most `max` consecutive days, each within one city.
 * A long stay is split evenly (7 days → 4 + 3, not 5 + 2).
 */
export function chunkSlots(slots: DaySlot[], max = MAX_DAYS_PER_CHUNK): SlotChunk[] {
  const runs: { start: number; slots: DaySlot[] }[] = [];
  slots.forEach((s, i) => {
    const last = runs[runs.length - 1];
    if (last && last.slots[0].city === s.city) last.slots.push(s);
    else runs.push({ start: i, slots: [s] });
  });
  const pieces: { start: number; slots: DaySlot[]; city: string }[] = [];
  for (const run of runs) {
    const n = Math.ceil(run.slots.length / max);
    const size = Math.ceil(run.slots.length / n);
    for (let k = 0; k < n; k++) {
      const part = run.slots.slice(k * size, (k + 1) * size);
      if (part.length) pieces.push({ start: run.start + k * size, slots: part, city: run.slots[0].city });
    }
  }
  // Number the parts per city, so a city visited twice (or split in two) shares its places out.
  const totals = new Map<string, number>();
  for (const p of pieces) totals.set(p.city, (totals.get(p.city) ?? 0) + 1);
  const seen = new Map<string, number>();
  return pieces.map((p) => {
    const part = seen.get(p.city) ?? 0;
    seen.set(p.city, part + 1);
    return { ...p, part, parts: totals.get(p.city)! };
  });
}

/** "Days 6–9" or "Day 6", 1-based. */
export function dayRangeLabel(start: number, count: number): string {
  return count <= 1 ? `Day ${start + 1}` : `Days ${start + 1}–${start + count}`;
}

const PER_CATEGORY: Record<PlaceCategory, number> = { see: 14, do: 6, eat: 10, drink: 4, sleep: 6, buy: 3 };

/** Ratings by guide place id, as remembered by the server (never fetched for the planner). */
export type RatingsById = Record<string, Pick<PlaceRating, "rating" | "count"> | null | undefined>;

/** A rating counts as dependable with a decent number of reviews behind it. */
const solid = (r: RatingsById[string]) => (r && r.rating !== undefined && (r.count === undefined || r.count >= 20) ? r.rating : undefined);

/** Guide order (photos, articles) with a nudge for places known to be well rated. */
const rankScore = (p: Place, ratings?: RatingsById) => {
  const r = solid(ratings?.[p.id]);
  return featureScore(p) + (r === undefined ? 0 : Math.max(0, r - 3.5) * 2); // 4.0 stars +1, 4.5 +2, 5.0 +3
};

export const rankedPlaces = (places: Place[], cat: PlaceCategory, ratings?: RatingsById) =>
  places.filter((p) => p.category === cat).sort((a, b) => rankScore(b, ratings) - rankScore(a, ratings));

/** "★4.6 (2,310)" for a place whose rating is known, else "". */
export function ratingLabel(r: RatingsById[string]): string {
  if (!r || r.rating === undefined) return "";
  return `★${r.rating.toFixed(1)}${r.count !== undefined ? ` (${new Intl.NumberFormat("en-US").format(r.count)})` : ""}`;
}

/** One candidate: "Da Dong [Roast duck, Splurge, ★4.5 (2,310)]". */
export function candidateLabel(p: Place, ratings?: RatingsById): string {
  const bits = [subcategoryOf(p), p.tier, ratingLabel(ratings?.[p.id])].filter(Boolean);
  return `${p.name} [${bits.join(", ")}]`;
}

/**
 * The guide's best places per category. When a city's days are split across several calls,
 * each part gets its own share (round-robin) so the parts don't plan the same places.
 * Ratings (when known) are shown and lift well-rated places.
 */
export function candidateList(places: Place[], part = 0, parts = 1, ratings?: RatingsById): string {
  const lines: string[] = [];
  for (const cat of Object.keys(PER_CATEGORY) as PlaceCategory[]) {
    const top = rankedPlaces(places, cat, ratings)
      .slice(0, PER_CATEGORY[cat] * Math.min(parts, 3))
      .filter((_, i) => i % parts === part)
      .slice(0, PER_CATEGORY[cat]);
    if (top.length) lines.push(`  ${CATEGORY_LABEL[cat]}: ${top.map((p) => candidateLabel(p, ratings)).join("; ")}`);
  }
  return lines.join("\n");
}

const VOICE = `You are the concierge for Intercontinental Nomad, a refined trip planner for travellers from the United States.
Write like a knowledgeable luxury travel editor: warm, precise, never breathless. Plain English, short sentences.`;

const OVERVIEW_SCHEMA = `{
  "title": string (evocative trip title, max 8 words),
  "summary": string (2-3 sentences describing the shape of the trip),
  "questions": [ { "id": string, "question": string (max 15 words), "options": string[2-6 short choices], "multi": boolean } ] (0-4 items),
  "routeSuggestion": null | { "reason": string, "stops": [ { "city": CITY_CODE, "nights": integer } ] },
  "beforeYouGo": [ { "topic": string (max 4 words), "summary": string (1-2 sentences), "details": string[] (0-4 short points), "important": boolean } ]
}`;

const DAYS_SCHEMA = `{
  "days": [ { "date": "YYYY-MM-DD", "city": CITY_CODE, "title": string (max 8 words), "items": [ { "time": "Morning"|"Afternoon"|"Evening"|"HH:MM", "title": string (max 10 words), "kind": "see"|"do"|"eat"|"drink"|"stay"|"travel"|"free", "placeName"?: string, "note"?: string (1-2 short sentences) } ] } ]
}`;

/** The traveller's own words and choices, shared by every call. */
function travellerBlock(r: PlanRequest): string {
  const answers = Object.entries(r.answers)
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k}: ${v.join(", ")}`)
    .join("; ");
  return `Traveller request: ${r.request.trim() || "(none given: suggest a well-balanced trip)"}
Preferences: ${r.preferences.join(", ") || "(none chosen)"}
Answers to earlier questions: ${answers || "(none)"}
Travellers: ${r.trip.adults} adult${r.trip.adults > 1 ? "s" : ""} from ${getCity(r.trip.home).name}, US passports. Leaving ${r.trip.departDate}.
Trip type: ${TRIP_TYPE_TEXT[r.trip.tripType ?? (r.trip.returnHome ? (r.trip.stops.length > 1 ? "multi" : "round") : "oneway")]}.${stopoverBlock(r)}`;
}

const TRIP_TYPE_TEXT = {
  oneway: "one way (no flight home)",
  round: "round trip",
  multi: "multi-city, flying home from the last city",
  stopover: "a planned stopover on the way, then the destination",
} as const;

/**
 * Stopover cities and programme hubs on this route, with the programme's benefit,
 * so the plan can use it (e.g. Icelandair's free Iceland stopover, China's
 * 240-hour visa-free transit). Terms change, so the model is told to say so.
 */
export function stopoverBlock(r: PlanRequest): string {
  const lines: string[] = [];
  for (const st of r.trip.stops) {
    const programmes = STOPOVER_PROGRAMMES.filter((p) => p.hubCity === st.city);
    const name = getCity(st.city).name;
    if (st.stopover) lines.push(`- ${name} is a planned stopover (${st.nights} ${st.nights === 1 ? "night" : "nights"}): treat it as a short, highlights-focused visit.`);
    for (const p of programmes) lines.push(`- ${p.airline} ${p.programme} (${p.hubName}): ${p.benefit} Mention it where useful and tell the traveller to check current terms: ${p.termsUrl}`);
  }
  return lines.length ? `\nStopovers and programmes on this route:\n${lines.join("\n")}` : "";
}

const routeLine = (r: PlanRequest) =>
  r.trip.stops.map((s) => `${getCity(s.city).name} (${s.city}) ${s.nights}n${s.stopover ? " [stopover]" : ""}`).join(" → ") || "(no stops chosen yet)";

/** The overview call: title, summary, questions, route suggestion and the "Before you go" brief. */
export function buildOverviewPrompt(r: PlanRequest): { system: string; user: string } {
  const noStops = r.trip.stops.length === 0;
  const allowed = CITIES.filter((c) => c.country !== "US").map((c) => `${c.code}=${c.name}`).join(", ");
  const system = `${VOICE}

Respond with ONE JSON object only, matching this shape exactly:
${OVERVIEW_SCHEMA}

Rules:
- The day-by-day plan is written separately. Do not include days.
- ${noStops ? `There are no stops yet: fill "routeSuggestion" with a sensible route and nights for the dates. CITY_CODE must be one of: ${allowed}.` : `The route is chosen: set "routeSuggestion" to null.`}
- Match detail to the request: if it is vague, ask 3-4 questions with short option chips to narrow it (interests, pace, budget, must-dos). If it is detailed, ask 0-2 questions.
- "beforeYouGo" covers, for US passport holders and these exact countries and dates: Visa & entry (important=true; describe the options clearly, say rules change, and tell them to confirm with official sources), Money & payments, Phone & internet, Getting around, Health & safety, Etiquette, Weather & packing. Be specific to the destinations (e.g. in mainland China many Western apps are blocked and mobile payments dominate). Do not state fees or durations you are unsure of. Keep each point short.`;

  const slots = daySlots(r);
  const countries = [...new Set(r.trip.stops.map((s) => getCity(s.city).countryName))].join(", ");
  const saved = Object.entries(r.trip.saved)
    .filter(([, names]) => names.length)
    .map(([c, names]) => `${findCity(c)?.name ?? c}: ${names.slice(0, 8).join("; ")}`)
    .join("\n");
  const user = `${travellerBlock(r)}
Route: ${routeLine(r)}
${slots.length ? `Dates: ${slots[0].date} to ${slots[slots.length - 1].date} (${slots.length} days). Countries: ${countries}.` : ""}
Saved places:
${saved || "(none)"}`;
  return { system, user };
}

/** A day-plan call for one chunk of consecutive days in one city. */
export function buildDaysPrompt(
  r: PlanRequest,
  chunk: SlotChunk,
  placesByCity: Record<string, Place[]>,
  ratings: RatingsById = {},
): { system: string; user: string } {
  const system = `${VOICE}

Respond with ONE JSON object only, matching this shape exactly:
${DAYS_SCHEMA}

Rules:
- Return exactly one "days" entry per day slot given, same date and city, in order. Up to 5 items per day.
- Keep every "note" to 1-2 short sentences. Keep titles short.
- Arrival and travel days are lighter. Include a "travel" item for each transfer with the mode and rough duration.
- Name real places. Every meal ("eat"), drink and sight should be a specific place from the candidate list whenever one fits: put its exact name, copied character for character, in "placeName" and use the name in the title (e.g. "Dinner at Da Dong"). Where ratings (★) are shown, prefer the higher-rated places, especially for meals.
- Use a generic description with no "placeName" only when nothing in the list fits. You may add a famous landmark that is not listed, but never invent a business name.
- Do not use the same place twice in the plan.
- Include the traveller's saved places listed below on suitable days.
- Group nearby sights on the same day; avoid crossing the city twice.`;

  const city = getCity(chunk.city);
  const places = placesByCity[chunk.city] ?? [];
  const savedAll = r.trip.saved[chunk.city] ?? [];
  const saved = savedAll.filter((_, i) => i % chunk.parts === chunk.part);
  let others = "";
  if (chunk.parts > 1) {
    const elsewhere = rankedPlaces(places, "see", ratings)
      .slice(0, PER_CATEGORY.see * Math.min(chunk.parts, 3))
      .filter((_, i) => i % chunk.parts !== chunk.part)
      .slice(0, 8)
      .map((p) => p.name);
    others = `\nOther days in ${city.name} are planned separately${elsewhere.length ? ` and already cover: ${elsewhere.join("; ")}. Don't repeat those` : ". Don't repeat the most famous sights on every part"}.`;
  }
  const user = `${travellerBlock(r)}
Whole route: ${routeLine(r)}

Write these day slots:
${chunk.slots.map((d, i) => `Day ${chunk.start + i + 1}: ${d.date} in ${d.city}${d.note ? ` (${d.note})` : ""}`).join("\n")}
${others}
Saved places in ${city.name}: ${saved.join("; ") || "(none)"}

Candidate places in ${city.name} (${chunk.city}) from the travel guide (★ = Google rating and number of reviews, when known):
${candidateList(places, chunk.part, chunk.parts, ratings) || "  (no guide listings available)"}`;
  return { system, user };
}
