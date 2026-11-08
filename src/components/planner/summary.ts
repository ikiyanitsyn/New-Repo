import { fmtRange } from "@/lib/format";
import { getCity } from "@/lib/cities";
import { tripEndDate, type Trip, type TripType } from "@/lib/trip";

export const TRIP_TYPE_LABEL: Record<TripType, string> = { oneway: "One way", round: "Round trip", multi: "Multi-city", stopover: "Stopover" };
export const CABIN_LABEL: Record<Trip["cabin"], string> = { economy: "Economy", premium: "Premium economy", business: "Business", first: "First" };

/** The trip type the traveller chose, or the one the route implies for older trips. */
export function effectiveTripType(trip: Trip): TripType {
  if (trip.tripType) return trip.tripType;
  if (!trip.returnHome) return "oneway";
  return trip.stops.length > 1 ? "multi" : "round";
}

/** From \u00b7 dates \u00b7 travellers \u00b7 cabin \u00b7 trip type, as separate parts for the summary line. */
export function summaryParts(trip: Trip): string[] {
  return [
    `From ${getCity(trip.home).name}`,
    trip.stops.length ? fmtRange(trip.departDate, tripEndDate(trip)) : fmtRange(trip.departDate, trip.departDate),
    `${trip.adults} ${trip.adults === 1 ? "traveller" : "travellers"}`,
    CABIN_LABEL[trip.cabin],
    TRIP_TYPE_LABEL[effectiveTripType(trip)],
  ];
}
