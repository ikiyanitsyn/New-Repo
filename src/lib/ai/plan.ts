import "server-only";
import { findCity, getCity } from "../cities";
import { cityPlaces } from "../places/wikivoyage";
import { featureScore } from "../places/subcategory";
import type { Place } from "../places/types";
import { officialLinks } from "./official";
import { buildPrompt, daySlots } from "./prompt";
import { AiError, getProvider } from "./provider";
import { PlanResponse, type PlanRequest } from "./schema";

export interface PlanResult {
  source: "gemini" | "sample";
  response: PlanResponse;
  official: ReturnType<typeof officialLinks>;
  notice?: string;
}

/** Pull the JSON object out of a model reply, tolerating stray code fences. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in the reply");
  return JSON.parse(t.slice(start, end + 1));
}

/** Keep only what the planner can show: known cities, the right dates, valid route stops. */
export function sanitize(resp: PlanResponse, r: PlanRequest): PlanResponse {
  const slots = daySlots(r);
  const slotDates = new Set(slots.map((s) => s.date));
  return {
    ...resp,
    days: slots.length ? resp.days.filter((d) => slotDates.has(d.date) && findCity(d.city)) : [],
    routeSuggestion: resp.routeSuggestion
      ? { ...resp.routeSuggestion, stops: resp.routeSuggestion.stops.filter((s) => findCity(s.city) && findCity(s.city)!.country !== "US") }
      : null,
  };
}

export async function makePlan(r: PlanRequest): Promise<PlanResult> {
  const cities = [...new Set(r.trip.stops.map((s) => s.city))];
  const official = officialLinks(cities);
  const guides = await Promise.all(cities.map((c) => cityPlaces(c)));
  const placesByCity = Object.fromEntries(guides.map((g) => [g.city, g.places]));

  const provider = getProvider();
  if (!provider) {
    return { source: "sample", response: samplePlan(r, placesByCity), official, notice: "Sample plan. Add a Gemini key to get a personal itinerary (docs/SETUP_GUIDE.md)." };
  }

  const { system, user } = buildPrompt(r, placesByCity);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt ? `\n\nYour previous reply could not be used (${lastError}). Reply again with valid JSON matching the shape exactly.` : "";
    let text: string;
    try {
      text = await provider.generateJson(system, user + extra);
    } catch (e) {
      if (e instanceof AiError) throw e;
      throw new AiError(e instanceof Error ? e.message : "The AI request failed.");
    }
    try {
      const parsed = PlanResponse.safeParse(extractJson(text));
      if (parsed.success) return { source: "gemini", response: sanitize(parsed.data, r), official };
      lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastError = e instanceof Error ? e.message : "invalid JSON";
    }
  }
  throw new AiError(`The AI reply didn't match the expected format (${lastError}). Please try again.`);
}

/** A plausible plan built from guide listings, used when no AI key is configured. */
export function samplePlan(r: PlanRequest, placesByCity: Record<string, Place[]>): PlanResponse {
  const slots = daySlots(r);
  const used = new Set<string>();
  const take = (city: string, cats: Place["category"][]) => {
    const p = (placesByCity[city] ?? [])
      .filter((x) => cats.includes(x.category) && !used.has(x.name))
      .sort((a, b) => featureScore(b) - featureScore(a))[0];
    if (p) used.add(p.name);
    return p;
  };
  const days = slots.map((s, i) => {
    const city = getCity(s.city);
    const items: PlanResponse["days"][number]["items"] = [];
    if (s.note) items.push({ time: "Morning", title: s.note[0].toUpperCase() + s.note.slice(1), kind: "travel" });
    const isLast = i === slots.length - 1;
    if (!isLast) {
      const sight = take(s.city, ["see"]);
      items.push(sight ? { time: "Afternoon", title: sight.name, kind: "see", placeName: sight.name } : { time: "Afternoon", title: `Walk the centre of ${city.name}`, kind: "see" });
      const meal = take(s.city, ["eat"]);
      items.push(meal ? { time: "Evening", title: `Dinner at ${meal.name}`, kind: "eat", placeName: meal.name } : { time: "Evening", title: "Dinner nearby", kind: "eat" });
      if (!s.note) {
        const act = take(s.city, ["do", "see"]);
        if (act) items.unshift({ time: "Morning", title: act.name, kind: act.category === "do" ? "do" : "see", placeName: act.name });
      }
    }
    return { date: s.date, city: s.city, title: isLast ? "Departure" : s.note ? `Arrive in ${city.name}` : `${city.name} at your own pace`, items };
  });
  return {
    title: "Sample itinerary",
    summary: "This sample plan is built from the city guides. Add a Gemini key to get a personal itinerary written for your interests.",
    questions: [
      { id: "interests", question: "What should the trip focus on?", options: ["Food", "History & temples", "Art & design", "Nature", "Nightlife", "Shopping"], multi: true },
      { id: "pace", question: "How full should the days be?", options: ["Relaxed", "Balanced", "Packed"], multi: false },
      { id: "budget", question: "What level of comfort?", options: ["Good value", "Comfortable", "Luxury"], multi: false },
    ],
    routeSuggestion: r.trip.stops.length ? null : { reason: "A classic first trip: imperial Beijing, the Terracotta Army in Xi'an, pandas and spice in Chengdu, then Shanghai and Hong Kong.", stops: [{ city: "BJS", nights: 4 }, { city: "SIA", nights: 2 }, { city: "CTU", nights: 3 }, { city: "SHA", nights: 3 }, { city: "HKG", nights: 3 }] },
    days,
    beforeYouGo: [
      { topic: "Visa & entry", summary: "Entry rules for US passport holders differ by country and change often. Check the official pages linked below before booking.", details: [], important: true },
      { topic: "Money & payments", summary: "Carry a card without foreign transaction fees and a little local cash.", details: [], important: false },
      { topic: "Phone & internet", summary: "An eSIM or roaming plan keeps maps and translation working from the moment you land.", details: [], important: false },
    ],
  };
}
