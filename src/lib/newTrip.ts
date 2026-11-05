import { addDays } from "./trip";
import { findCity } from "./cities";
import type { TripAction } from "./tripReducer";

/** What the opening page's search composer collects. */
export interface NewTripInput {
  home: string; // US departure city code
  destination?: string; // first city code; empty lets the concierge suggest a route
  departDate: string; // YYYY-MM-DD
  nights: number;
  adults: number;
}

export type Guests = "solo" | "two" | "group";

export const guestsToAdults = (g: Guests, groupSize: number) =>
  g === "solo" ? 1 : g === "two" ? 2 : Math.max(3, Math.min(9, Math.round(groupSize)));

/** A sensible default departure: about eight weeks out, when fares are usually reasonable. */
export const defaultDepartDate = (today: Date = new Date()) => addDays(today.toISOString().slice(0, 10), 56);

/**
 * The reducer actions that turn the composer's answers into a fresh trip.
 * Starts from a clean example (no old fares, saved places or AI plan), then
 * applies home, date, travellers and the first stop.
 */
export function newTripActions(input: NewTripInput): TripAction[] {
  const nights = Math.max(1, Math.min(30, Math.round(input.nights) || 1));
  const actions: TripAction[] = [
    { type: "reset" },
    { type: "home", city: input.home },
    { type: "date", date: input.departDate },
    { type: "adults", value: input.adults },
    { type: "replaceStops", stops: input.destination ? [{ city: input.destination, nights }] : [] },
  ];
  const city = input.destination ? findCity(input.destination) : undefined;
  actions.push({ type: "title", title: city ? `${city.name} trip` : "My trip" });
  return actions;
}
