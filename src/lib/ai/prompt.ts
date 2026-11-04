import { CITIES, findCity, getCity } from "../cities";
import { addDays, stopsWithDates, type Trip } from "../trip";
import { CATEGORY_LABEL, type Place, type PlaceCategory } from "../places/types";
import { featureScore, subcategoryOf } from "../places/subcategory";
import type { PlanRequest } from "./schema";

export interface DaySlot { date: string; city: string; note: string }

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
    stops: r.trip.stops.map((s, i) => ({ id: `s${i}`, city: s.city, nights: s.nights })),
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

const PER_CATEGORY: Record<PlaceCategory, number> = { see: 14, do: 6, eat: 10, drink: 4, sleep: 6, buy: 3 };

export function candidateList(places: Place[]): string {
  const lines: string[] = [];
  for (const cat of Object.keys(PER_CATEGORY) as PlaceCategory[]) {
    const top = places
      .filter((p) => p.category === cat)
      .sort((a, b) => featureScore(b) - featureScore(a))
      .slice(0, PER_CATEGORY[cat]);
    if (top.length) lines.push(`  ${CATEGORY_LABEL[cat]}: ${top.map((p) => `${p.name} [${subcategoryOf(p)}${p.tier ? `, ${p.tier}` : ""}]`).join("; ")}`);
  }
  return lines.join("\n");
}

const SCHEMA = `{
  "title": string (evocative trip title, max 8 words),
  "summary": string (2-3 sentences describing the shape of the trip),
  "questions": [ { "id": string, "question": string, "options": string[2-6 short choices], "multi": boolean } ] (0-4 items),
  "routeSuggestion": null | { "reason": string, "stops": [ { "city": CITY_CODE, "nights": integer } ] },
  "days": [ { "date": "YYYY-MM-DD", "city": CITY_CODE, "title": string, "items": [ { "time": "Morning"|"Afternoon"|"Evening"|"HH:MM", "title": string, "kind": "see"|"do"|"eat"|"drink"|"stay"|"travel"|"free", "placeName"?: string, "note"?: string } ] } ],
  "beforeYouGo": [ { "topic": string, "summary": string, "details": string[], "important": boolean } ]
}`;

export function buildPrompt(r: PlanRequest, placesByCity: Record<string, Place[]>): { system: string; user: string } {
  const allowed = CITIES.filter((c) => c.country !== "US").map((c) => `${c.code}=${c.name}`).join(", ");
  const system = `You are the concierge for Intercontinental Nomad, a refined trip planner for travellers from the United States.
Write like a knowledgeable luxury travel editor: warm, precise, never breathless. Plain English, short sentences.

Respond with ONE JSON object only, matching this shape exactly:
${SCHEMA}

Rules:
- CITY_CODE must be one of: ${allowed}.
- When day slots are given, return exactly one "days" entry per slot, same date and city, in order. Up to 5 items per day.
- Arrival and travel days are lighter. Include a "travel" item for each transfer with the mode and rough duration.
- Prefer places from the candidate lists, using their exact names in "placeName". You may add famous landmarks that are not listed. Never invent a business name; if unsure, describe it generically (e.g. "a family-run noodle shop near the Drum Tower").
- Always include the traveller's saved places on suitable days.
- Group nearby sights on the same day; avoid crossing the city twice.
- Match detail to the request: if it is vague, plan a balanced first draft AND ask 3-4 questions with short option chips to narrow it (interests, pace, budget, must-dos). If it is detailed, ask 0-2 questions.
- If there are no stops yet, leave "days" empty and fill "routeSuggestion" with a sensible route and nights for the dates.
- "beforeYouGo" covers, for US passport holders and these exact countries and dates: Visa & entry (important=true; describe the options clearly, say rules change, and tell them to confirm with official sources), Money & payments, Phone & internet, Getting around, Health & safety, Etiquette, Weather & packing. Be specific to the destinations (e.g. in mainland China many Western apps are blocked and mobile payments dominate). Do not state fees or durations you are unsure of.`;

  const slots = daySlots(r);
  const stops = r.trip.stops.map((s, i) => `${i + 1}. ${getCity(s.city).name} (${s.city}), ${s.nights} nights`).join("\n");
  const places = r.trip.stops
    .map((s) => s.city)
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .map((c) => `${getCity(c).name} (${c}):\n${candidateList(placesByCity[c] ?? []) || "  (no guide listings available)"}`)
    .join("\n");
  const saved = Object.entries(r.trip.saved)
    .filter(([, names]) => names.length)
    .map(([c, names]) => `${findCity(c)?.name ?? c}: ${names.join("; ")}`)
    .join("\n");
  const answers = Object.entries(r.answers)
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k}: ${v.join(", ")}`)
    .join("\n");

  const user = `Traveller request: ${r.request.trim() || "(none given: suggest a well-balanced trip)"}
Preferences: ${r.preferences.join(", ") || "(none chosen)"}
Answers to earlier questions:
${answers || "(none)"}

Travellers: ${r.trip.adults} adult${r.trip.adults > 1 ? "s" : ""} from ${getCity(r.trip.home).name}, US passports. Leaving ${r.trip.departDate}.
Route:
${stops || "(no stops chosen yet)"}

Day slots:
${slots.map((d, i) => `Day ${i + 1}: ${d.date} in ${d.city}${d.note ? ` (${d.note})` : ""}`).join("\n") || "(none)"}

Saved places:
${saved || "(none)"}

Candidate places from the travel guide:
${places || "(none)"}`;

  return { system, user };
}
