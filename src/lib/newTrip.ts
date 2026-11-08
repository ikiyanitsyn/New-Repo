import { addDays, tripEndDate, type Trip, type TripType } from "./trip";
import { findCity, getCity, type City } from "./cities";
import { fmtShort } from "./format";
import type { Cabin } from "./flights/types";
import type { TripAction } from "./tripReducer";

/** What the opening page's search composer collects (the original single-city form). */
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

export const adultsToGuests = (adults: number): Guests => (adults <= 1 ? "solo" : adults === 2 ? "two" : "group");

/** A sensible default departure: about eight weeks out, when fares are usually reasonable. */
export const defaultDepartDate = (today: Date = new Date()) => addDays(today.toISOString().slice(0, 10), 56);

const clampNights = (n: number) => Math.max(1, Math.min(30, Math.round(n) || 1));

/**
 * The reducer actions that turn the composer's answers into a fresh trip.
 * Starts from a clean example (no old fares, saved places or AI plan), then
 * applies home, date, travellers and the first stop.
 */
export function newTripActions(input: NewTripInput): TripAction[] {
  const nights = clampNights(input.nights);
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

/* ------------------------------------------------------------------ */
/* The home-page search: one way · round trip · multi-city · stopover */
/* ------------------------------------------------------------------ */

export interface SearchCity {
  /** Stable key for React lists and reordering (not saved in the trip). */
  key: string;
  city: string;
  nights: number;
}

export interface TripSearch {
  tripType: TripType;
  home: string;
  /** Destination for one way, round trip and stopover. */
  to?: string;
  /** Multi-city: the cities in order, each with nights. The trip flies home from the last one. */
  cities: SearchCity[];
  /** Stopover type: the city you stop in on the way, and for how long. */
  stopover?: { city?: string; nights: number };
  departDate: string;
  /** Round trip and stopover: the day you fly home. */
  returnDate?: string;
  /** One way: how long you stay (no return flight, but hotels and guides still need nights). */
  nights: number;
  adults: number;
  cabin: Cabin;
}

export const DEFAULT_STOPOVER_NIGHTS = 2;

/** Whole nights between two YYYY-MM-DD dates (negative when b is before a). */
export function nightsBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/**
 * Days lost to the flight on the way out. Mirrors trip.ts: flights from North
 * America to anywhere else land the next calendar day, so a round trip of
 * 14 days spends 13 nights on the ground.
 */
export function arrivalOffset(home: City, first: City): number {
  return home.region === "North America" && first.region !== "North America" ? 1 : 0;
}

/** Which date the calendar asks for: a range (depart → return) or a single departure date. */
export const calendarMode = (t: TripType): "range" | "single" => (t === "round" || t === "stopover" ? "range" : "single");

/** The first city you fly into, for the arrival-day offset. */
function firstCity(s: TripSearch): string | undefined {
  if (s.tripType === "multi") return s.cities[0]?.city;
  if (s.tripType === "stopover") return s.stopover?.city ?? s.to;
  return s.to;
}

/** Nights on the ground for a depart → return range (after the overnight flight out). */
export function groundNights(s: TripSearch): number {
  if (!s.returnDate) return 0;
  const first = firstCity(s);
  const offset = first && findCity(s.home) && findCity(first) ? arrivalOffset(getCity(s.home), getCity(first)) : 0;
  return nightsBetween(s.departDate, s.returnDate) - offset;
}

export type SearchProblem = { field: "to" | "dates" | "cities" | "stopover" | "home"; message: string };

/** Everything the search needs before it can build a trip, in the order a person would fix it. */
export function searchProblem(s: TripSearch): SearchProblem | null {
  if (!findCity(s.home)) return { field: "home", message: "Choose where you are flying from." };
  if (s.tripType === "multi") {
    if (s.cities.length === 0) return { field: "cities", message: "Add at least one city." };
    return null;
  }
  if (s.tripType === "stopover") {
    if (!s.stopover?.city) return { field: "stopover", message: "Choose a stopover city." };
    if (!s.to) return { field: "to", message: "Choose your destination." };
    if (s.stopover.city === s.to) return { field: "stopover", message: "The stopover and the destination are the same city." };
  } else if (!s.to) {
    return { field: "to", message: "Choose where you are going." };
  }
  if (calendarMode(s.tripType) === "range") {
    if (!s.returnDate) return { field: "dates", message: "Choose a return date." };
    const ground = groundNights(s);
    const needed = s.tripType === "stopover" ? clampNights(s.stopover?.nights ?? DEFAULT_STOPOVER_NIGHTS) + 1 : 1;
    if (ground < needed) {
      return {
        field: "dates",
        message: s.tripType === "stopover"
          ? `Allow at least ${needed} nights on the ground: the stopover plus one night at your destination.`
          : "The return date leaves no nights at your destination. Choose a later return.",
      };
    }
  }
  return null;
}

/** The stops the search describes, in travel order. */
export function searchStops(s: TripSearch): { city: string; nights: number; stopover?: boolean }[] {
  switch (s.tripType) {
    case "multi":
      return s.cities.map((c) => ({ city: c.city, nights: clampNights(c.nights) }));
    case "oneway":
      return s.to ? [{ city: s.to, nights: clampNights(s.nights) }] : [];
    case "round":
      return s.to ? [{ city: s.to, nights: clampNights(s.returnDate ? groundNights(s) : s.nights) }] : [];
    case "stopover": {
      const hubNights = clampNights(s.stopover?.nights ?? DEFAULT_STOPOVER_NIGHTS);
      const stops: { city: string; nights: number; stopover?: boolean }[] = [];
      if (s.stopover?.city) stops.push({ city: s.stopover.city, nights: hubNights, stopover: true });
      if (s.to) stops.push({ city: s.to, nights: clampNights(s.returnDate ? groundNights(s) - hubNights : s.nights) });
      return stops;
    }
  }
}

function searchTitle(s: TripSearch): string {
  const stops = searchStops(s).filter((x) => !x.stopover);
  const names = stops.map((x) => findCity(x.city)?.name).filter(Boolean) as string[];
  if (names.length === 0) return "My trip";
  if (names.length === 1) return `${names[0]} trip`;
  const countries = new Set(stops.map((x) => findCity(x.city)?.countryName));
  if (countries.size === 1) return `${[...countries][0]} trip`;
  return names.length === 2 ? `${names[0]} & ${names[1]}` : `${names[0]} to ${names[names.length - 1]}`;
}

/**
 * Reducer actions that turn a home-page search into a fresh trip. The trip
 * type sets whether it flies home: one way does not; round trip returns from
 * the arrival city; multi-city and stopover fly home from the last city.
 */
export function searchTripActions(s: TripSearch): TripAction[] {
  return [
    { type: "reset" },
    { type: "home", city: s.home },
    { type: "date", date: s.departDate },
    { type: "adults", value: s.adults },
    { type: "cabin", value: s.cabin },
    { type: "tripType", value: s.tripType },
    { type: "replaceStops", stops: searchStops(s) },
    { type: "title", title: searchTitle(s) },
  ];
}

let keyCounter = 0;
export const searchKey = () => `c${Date.now().toString(36)}${(keyCounter++).toString(36)}`;

/** A search pre-filled from the trip on this device: same home, travellers and cabin; fresh dates. */
export function initialSearch(trip: Trip, today: Date = new Date()): TripSearch {
  const departDate = defaultDepartDate(today);
  return {
    tripType: "round",
    home: trip.home,
    to: undefined,
    cities: [],
    stopover: { city: undefined, nights: DEFAULT_STOPOVER_NIGHTS },
    departDate,
    returnDate: addDays(departDate, 8),
    nights: 7,
    adults: trip.adults,
    cabin: trip.cabin,
  };
}

/** Switching trip type keeps whatever carries over (destination, first city, dates). */
export function switchTripType(s: TripSearch, t: TripType): TripSearch {
  if (t === s.tripType) return s;
  const next: TripSearch = { ...s, tripType: t };
  if (t === "multi" && s.cities.length === 0) {
    // Carry the route over: a stopover trip becomes hub + destination; anything else becomes its destination.
    next.cities = searchStops(s).map((x) => ({ key: searchKey(), city: x.city, nights: x.nights }));
  }
  if (s.tripType === "multi" && t !== "multi" && !s.to && s.cities.length) next.to = s.cities[s.cities.length - 1].city;
  if (calendarMode(t) === "range" && !next.returnDate) next.returnDate = addDays(s.departDate, Math.max(2, s.nights + 1));
  if (t === "stopover" && !next.stopover) next.stopover = { nights: DEFAULT_STOPOVER_NIGHTS };
  return next;
}

/** "China in spring · Apr 8–24 · 5 cities" for the Continue card. */
export function tripSummaryLine(trip: Trip): { title: string; meta: string } {
  const n = trip.stops.length;
  const meta: string[] = [];
  if (n) {
    const a = fmtShort(trip.departDate); // "Apr 8"
    const b = fmtShort(tripEndDate(trip)); // "Apr 24"
    const [ma] = a.split(" ");
    const [mb, db] = b.split(" ");
    meta.push(ma === mb ? `${a}–${db}` : `${a} – ${b}`);
    meta.push(`${n} ${n === 1 ? "city" : "cities"}`);
  } else {
    meta.push(`from ${fmtShort(trip.departDate)}`, "no cities yet");
  }
  return { title: trip.title || "Your trip", meta: meta.join(" · ") };
}
