import type { City } from "../cities";
import type { Place } from "./types";

const q = encodeURIComponent;

export interface OutLink { label: string; url: string }

/** Where to look a place up: maps, reviews, its own site. */
export function placeLinks(p: Place, city: City): OutLink[] {
  const links: OutLink[] = [];
  const where = `${p.name}, ${city.name}`;
  links.push({ label: "Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${q(where)}` });
  if (city.country === "CN") {
    // Google Maps is blocked in mainland China and its streets are offset; Amap is the local standard.
    links.push({ label: "Amap", url: `https://uri.amap.com/search?keyword=${q(p.alt || p.name)}&city=${q(city.localName ?? city.name)}&callnative=1` });
    if (p.lat !== undefined && p.lon !== undefined)
      links.push({ label: "Apple Maps", url: `https://maps.apple.com/?q=${q(p.name)}&ll=${p.lat},${p.lon}` });
  }
  links.push({ label: "TripAdvisor", url: `https://www.tripadvisor.com/Search?q=${q(where)}` });
  if (p.url) links.push({ label: "Website", url: p.url });
  return links;
}

/** Countries where Trip.com is the local favourite and often has more hotels. */
export const TRIP_COM_COUNTRIES = new Set(["CN", "HK", "MO"]);

/**
 * Trip.com's own city numbers (as seen in its hotel-list addresses).
 * Unverified from this sandbox; cities not listed fall back to a keyword search.
 */
const TRIP_COM_CITY: Record<string, number> = {
  BJS: 1, SHA: 2, CKG: 4, SIA: 10, HGH: 17, CTU: 28, SZX: 30, CAN: 32, KWL: 33, HKG: 58, MFM: 59,
};

export function tripComHotelsUrl(city: City, checkin: string, checkout: string, adults: number): string {
  const id = TRIP_COM_CITY[city.code];
  const where = id ? `city=${id}` : `keyword=${q(city.name)}`;
  return `https://www.trip.com/hotels/list?${where}&checkIn=${checkin}&checkOut=${checkout}&adult=${adults}&crn=1`;
}

/**
 * Hotel searches pre-filled with this stop's dates and travellers.
 * Booking.com always comes first (the primary button); Trip.com is added for
 * mainland China, Hong Kong and Macau; Google Hotels stays as a comparison.
 */
export function staySearchLinks(city: City, checkin: string, checkout: string, adults: number): OutLink[] {
  const links: OutLink[] = [
    {
      label: "Booking.com",
      url: `https://www.booking.com/searchresults.html?ss=${q(`${city.name}, ${city.countryName}`)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=1`,
    },
  ];
  if (TRIP_COM_COUNTRIES.has(city.country)) links.push({ label: "Trip.com", url: tripComHotelsUrl(city, checkin, checkout, adults) });
  links.push({ label: "Google Hotels", url: `https://www.google.com/travel/search?q=${q(`hotels in ${city.name}`)}&dates=${checkin},${checkout}` });
  return links;
}

/** A small thumbnail from Wikimedia Commons for a guide image. */
export function commonsThumb(file: string, width = 240): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${q(file.replace(/^(File|Image):/i, ""))}?width=${width}`;
}
