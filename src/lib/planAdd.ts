import { chronologicalIndex, dayIndexByDate, insertItem } from "./ai/edit";
import { daySlots } from "./ai/prompt";
import { PlanRequest, type PlanItem, type PlanResponse, type SavedPlan } from "./ai/schema";
import type { Place } from "./places/types";
import { tripLegs, type Trip } from "./trip";

const KIND: Record<Place["category"], PlanItem["kind"]> = { see: "see", do: "do", eat: "eat", drink: "drink", sleep: "stay", buy: "do" };

/** The planner's request shape built from the trip (for day slots). */
export function requestFromTrip(trip: Trip) {
  return PlanRequest.parse({
    trip: {
      home: trip.home, departDate: trip.departDate, adults: trip.adults, cabin: trip.cabin, returnHome: trip.returnHome,
      stops: trip.stops.map((s) => ({ city: s.city, nights: s.nights, ...(s.stopover ? { stopover: true } : {}) })),
      modes: tripLegs(trip).filter((l) => l.kind === "between").map((l) => l.mode),
      tripType: trip.tripType,
    },
  });
}

/** An empty day-by-day plan for the trip, to add your own places to. */
export function blankPlan(trip: Trip): SavedPlan {
  const days = daySlots(requestFromTrip(trip)).map((d) => ({ date: d.date, city: d.city, title: d.note ? d.note[0].toUpperCase() + d.note.slice(1) : "Free day", items: [] as PlanItem[] }));
  const response: PlanResponse = { title: trip.title || "My trip", summary: "Your own day-by-day plan. Add places from the city guides, or ask the concierge to fill in the rest.", questions: [], routeSuggestion: null, days, beforeYouGo: [] };
  return { createdAt: new Date().toISOString(), source: "manual", request: "", preferences: [], answers: {}, forStops: trip.stops.map((s) => `${s.city}:${s.nights}`).join(",") + `|${trip.departDate}`, response };
}

/**
 * Add a guide place to a day of the plan (creating a blank plan first if there
 * is none). Returns the updated plan, or null when that date isn't in the trip.
 */
export function addPlaceToPlan(trip: Trip, place: Place, date: string, time: string): SavedPlan | null {
  const plan = trip.plan ?? blankPlan(trip);
  const day = dayIndexByDate(plan.response, date);
  if (day < 0) return null;
  const item: PlanItem = {
    time,
    title: place.name,
    kind: KIND[place.category],
    placeName: place.name,
    mine: true,
    ...(place.description ? { note: place.description.split(/(?<=[.!?])\s/)[0].slice(0, 200) } : {}),
  };
  const items = plan.response.days[day].items;
  if (items.some((it) => it.placeName === place.name)) return plan; // already on that day
  return { ...plan, response: insertItem(plan.response, day, item, chronologicalIndex(items, time)) };
}
