import { estimateLeg } from "./ground";
import { stopsWithDates, tripLegs, type Trip } from "./trip";

/**
 * The whole-trip budget used by the planner, the itinerary and the PDF:
 * flights (chosen fares), ground legs (estimates), hotels (chosen hotel × nights)
 * and activities/other costs. All USD.
 */
export interface Budget {
  flights: number;
  ground: number;
  hotels: number;
  activities: number;
  total: number;
  perPerson: number;
  /** Things still to choose, e.g. "2 flights", "1 hotel". */
  missing: { flights: number; hotels: number; hotelPrices: number };
}

export function tripBudget(trip: Trip): Budget {
  const legs = tripLegs(trip);
  let flights = 0, ground = 0, hotels = 0, missingFlights = 0, missingHotels = 0, missingHotelPrices = 0;
  for (const l of legs) {
    if (l.mode === "flight") {
      const pick = trip.picks?.[l.id];
      if (pick && pick.date === l.date) flights += pick.priceTotal;
      else missingFlights++;
    } else {
      const e = estimateLeg(l.from, l.to, l.mode);
      ground += e.priceBasis === "per person" ? e.priceUsd * trip.adults : e.priceUsd;
    }
  }
  // One hotel entry per city covers every stop in that city.
  for (const s of stopsWithDates(trip)) {
    const h = trip.hotels?.[s.city];
    if (!h) missingHotels++;
    else if (h.nightly === undefined) missingHotelPrices++;
    else hotels += h.nightly * s.nights;
  }
  const activities = (trip.costs ?? []).reduce((sum, c) => sum + c.amount, 0);
  const total = flights + ground + hotels + activities;
  return {
    flights: Math.round(flights),
    ground: Math.round(ground),
    hotels: Math.round(hotels),
    activities: Math.round(activities),
    total: Math.round(total),
    perPerson: Math.round(total / Math.max(1, trip.adults)),
    missing: { flights: missingFlights, hotels: missingHotels, hotelPrices: missingHotelPrices },
  };
}
