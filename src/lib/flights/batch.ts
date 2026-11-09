import type { Leg, Trip } from "../trip";
import { BEST_PRICE_WEIGHT, sortOffers } from "./rank";
import type { FlightSearchResult } from "./types";

/** A quick price summary for one flight leg, shown on the itinerary after "Search all flights". */
export interface FareQuote {
  cheapest: number;
  best: number;
  bestAirline: string;
  source: FlightSearchResult["source"];
  live: boolean;
  date: string;
}

/**
 * The same request the fares panel makes, so results are shared: a live search
 * here is reused (from the server's cache) when you open that flight, at no extra cost.
 */
export function fareRequestUrl(leg: Leg, trip: Trip, live: boolean): string {
  const p = new URLSearchParams({
    from: leg.from.code, to: leg.to.code, date: leg.date,
    adults: String(trip.adults), cabin: trip.cabin, mode: live ? "live" : "cached",
    ...(live ? { stops: "any" } : {}),
  });
  return `/api/flights?${p}`;
}

export function quoteFrom(r: FlightSearchResult, leg: Leg, live: boolean): FareQuote | null {
  if (!r.offers.length) return null;
  const cheapest = Math.min(...r.offers.map((o) => o.priceTotal));
  const best = sortOffers(r.offers, "best", BEST_PRICE_WEIGHT)[0];
  return { cheapest, best: best.priceTotal, bestAirline: best.airlines[0] ?? "", source: r.source, live, date: leg.date };
}

export const flightLegs = (legs: Leg[]) => legs.filter((l) => l.mode === "flight");
