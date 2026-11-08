import type { City } from "../cities";
import type { ChosenHotel } from "../trip";
import type { LiveHotel } from "./types";

const q = encodeURIComponent;

/** Booking.com search for this hotel on the stop's dates. Booking.com stays the primary place to book. */
export function hotelBookingUrl(name: string, city: Pick<City, "name" | "countryName">, checkin: string, checkout: string, adults: number): string {
  return `https://www.booking.com/searchresults.html?ss=${q(`${name}, ${city.name}, ${city.countryName}`)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=1`;
}

export interface ChooseInput {
  /** The guide's name for the place, or the live result's name for a hotel that is only in the price results. */
  name: string;
  lat?: number;
  lon?: number;
  /** A live price for this hotel, when the traveller has checked prices. */
  live?: Pick<LiveHotel, "nightly" | "lat" | "lon">;
  /** When the live prices were fetched (ISO). */
  livePricedAt?: string;
  /** A price the traveller typed in, USD per night. Used only without a live price. */
  manualNightly?: number;
  bookingUrl?: string;
  /** Used for the manual price's timestamp. */
  now?: Date;
}

/** The `ChosenHotel` to store for the traveller's pick. */
export function toChosenHotel(i: ChooseInput): ChosenHotel {
  const lat = i.lat ?? i.live?.lat;
  const lon = i.lon ?? i.live?.lon;
  const base = { name: i.name, bookingUrl: i.bookingUrl, ...(lat !== undefined && lon !== undefined ? { lat, lon } : {}) };
  if (i.live?.nightly !== undefined) {
    return { ...base, nightly: i.live.nightly, source: "google_hotels", pricedAt: i.livePricedAt ?? (i.now ?? new Date()).toISOString() };
  }
  if (i.manualNightly !== undefined && Number.isFinite(i.manualNightly) && i.manualNightly > 0) {
    return { ...base, nightly: Math.round(i.manualNightly * 100) / 100, source: "manual", pricedAt: (i.now ?? new Date()).toISOString() };
  }
  return { ...base, source: "guide" };
}

/** "142", "$142.50", "US$ 1,200" to a number, or undefined. */
export function parseTypedPrice(text: string): number | undefined {
  const m = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return n > 0 && n < 100000 ? n : undefined;
}
