import { findCity, getCity, type City } from "./cities";
import { defaultMode, type Mode } from "./ground";
import { distanceKm } from "./geo";
import type { Cabin } from "./flights/types";

export interface Stop {
  id: string;
  city: string; // city code
  nights: number;
}

export interface Trip {
  version: 1;
  title: string;
  home: string; // US departure city
  departDate: string; // YYYY-MM-DD, day you leave home
  returnHome: boolean;
  stops: Stop[]; // first = fly in, last = fly out
  legModes: Record<string, Mode>; // key: `${fromStopId}>${toStopId}`
  adults: number;
  cabin: Cabin;
  /** Flights the traveller has chosen, by leg id. */
  picks?: Record<string, FlightPick>;
  /** Places the traveller saved, by city code. */
  saved?: Record<string, SavedPlace[]>;
  /** The latest AI day-by-day plan. */
  plan?: import("./ai/schema").SavedPlan;
}

export interface SavedPlace {
  key: string; // lower-cased name; stable across guide refreshes
  name: string;
  category: import("./places/types").PlaceCategory;
  lat?: number;
  lon?: number;
}

export const placeKey = (name: string) => name.trim().toLowerCase();

export interface FlightPick {
  offerId: string;
  date: string; // the leg date it was chosen for; ignored if the date moves
  priceTotal: number;
  airlines: string[];
  durationMin: number;
  stops: number;
  departLocal: string;
  source: "travelpayouts" | "serpapi" | "sample";
  bookingUrl?: string;
}

export type LegKind = "outbound" | "between" | "return";

export interface Leg {
  id: string;
  kind: LegKind;
  from: City;
  to: City;
  date: string; // travel date
  mode: Mode;
  distanceKm: number;
}

export interface StopWithDates extends Stop {
  cityInfo: City;
  arrive: string;
  depart: string;
}

let counter = 0;
export const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Long-haul flights from the US to Asia arrive the next calendar day. */
function arrivalDayOffset(home: City, first: City): number {
  return home.region === "North America" && first.region !== "North America" ? 1 : 0;
}

export function stopsWithDates(trip: Trip): StopWithDates[] {
  if (trip.stops.length === 0) return [];
  const home = getCity(trip.home);
  let cursor = addDays(trip.departDate, arrivalDayOffset(home, getCity(trip.stops[0].city)));
  return trip.stops.map((s) => {
    const arrive = cursor;
    const depart = addDays(arrive, s.nights);
    cursor = depart;
    return { ...s, cityInfo: getCity(s.city), arrive, depart };
  });
}

export const legKey = (a: Stop, b: Stop) => `${a.id}>${b.id}`;

export function tripLegs(trip: Trip): Leg[] {
  const home = getCity(trip.home);
  const stops = stopsWithDates(trip);
  if (stops.length === 0) return [];
  const legs: Leg[] = [];
  const first = stops[0];
  legs.push({ id: "outbound", kind: "outbound", from: home, to: first.cityInfo, date: trip.departDate, mode: "flight", distanceKm: distanceKm(home, first.cityInfo) });
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    const mode = trip.legModes[legKey(a, b)] ?? defaultMode(a.cityInfo, b.cityInfo);
    legs.push({ id: legKey(a, b), kind: "between", from: a.cityInfo, to: b.cityInfo, date: a.depart, mode, distanceKm: distanceKm(a.cityInfo, b.cityInfo) });
  }
  if (trip.returnHome) {
    const last = stops[stops.length - 1];
    legs.push({ id: "return", kind: "return", from: last.cityInfo, to: home, date: last.depart, mode: "flight", distanceKm: distanceKm(last.cityInfo, home) });
  }
  return legs;
}

export function tripNights(trip: Trip): number {
  return trip.stops.reduce((n, s) => n + s.nights, 0);
}

export function tripEndDate(trip: Trip): string {
  const s = stopsWithDates(trip);
  return s.length ? s[s.length - 1].depart : trip.departDate;
}

/** The example trip a first-time visitor sees: a spring loop through China ending in Hong Kong. */
export function sampleTrip(): Trip {
  return {
    version: 1,
    title: "China in spring",
    home: "NYC",
    departDate: "2027-04-08",
    returnHome: true,
    adults: 1,
    cabin: "economy",
    stops: [
      { id: "beijing", city: "BJS", nights: 4 },
      { id: "xian", city: "SIA", nights: 2 },
      { id: "chengdu", city: "CTU", nights: 3 },
      { id: "shanghai", city: "SHA", nights: 3 },
      { id: "hongkong", city: "HKG", nights: 3 },
    ],
    legModes: { "chengdu>shanghai": "flight" },
  };
}

export function isTrip(v: unknown): v is Trip {
  const t = v as Trip;
  return (
    !!t && t.version === 1 && !!findCity(t.home) && Array.isArray(t.stops) &&
    t.stops.every((s) => !!findCity(s.city) && typeof s.nights === "number" && typeof s.id === "string")
  );
}
