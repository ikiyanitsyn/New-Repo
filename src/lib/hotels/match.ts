import type { City } from "../cities";
import { matchCandidate } from "../places/match";
import type { Place } from "../places/types";
import type { LiveHotel } from "./types";

export interface HotelMatches {
  /** Live hotel by guide place id. */
  byPlaceId: Record<string, LiveHotel>;
  /** Priced hotels that are not in the guide. */
  unmatched: LiveHotel[];
}

/**
 * Pair guide stays with live hotel results by name and coordinates
 * (same rules as the ratings provider: see matchCandidate). Each hotel is used
 * once. Hotels without a price and without a guide listing are dropped, since
 * they add nothing the guide doesn't have.
 */
export function matchHotels(stays: Place[], hotels: LiveHotel[], city: Pick<City, "lat" | "lon" | "name">): HotelMatches {
  const free = new Set(hotels);
  const byPlaceId: Record<string, LiveHotel> = {};
  // Listings with a pin first: they have the stricter test to pass.
  const ordered = [...stays].sort((a, b) => Number(b.lat !== undefined) - Number(a.lat !== undefined));
  for (const p of ordered) {
    const hit = matchCandidate(p, [...free], { cityCentre: { lat: city.lat, lon: city.lon }, ignore: [city.name] });
    if (hit) {
      byPlaceId[p.id] = hit;
      free.delete(hit);
    }
  }
  return { byPlaceId, unmatched: hotels.filter((h) => free.has(h) && h.nightly !== undefined) };
}

/** A guide-style listing for a priced hotel that the guide doesn't have, so cards, pins and pages treat it alike. */
export function livePlace(h: LiveHotel, index: number): Place {
  return {
    id: `live:${index}`,
    category: "sleep",
    name: h.name,
    lat: h.lat,
    lon: h.lon,
    thumb: h.thumb,
    description: h.description,
  };
}

export const isLivePlaceId = (id: string) => id.startsWith("live:");
