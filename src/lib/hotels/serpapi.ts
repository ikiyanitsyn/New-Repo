import type { City } from "../cities";
import type { HotelsQuery, LiveHotel } from "./types";

/**
 * SerpApi Google Hotels engine: live hotel prices for a city and dates.
 * Docs: https://serpapi.com/google-hotels-api
 *
 * Request: engine=google_hotels, q, check_in_date, check_out_date (YYYY-MM-DD),
 * adults, currency=USD, gl=us, hl=en. One request is one SerpApi search.
 *
 * Response fields used, from properties[]:
 *  name, type, description, link, gps_coordinates {latitude, longitude},
 *  rate_per_night.extracted_lowest (else extracted_display_price / extracted_before_taxes_fees),
 *  total_rate.extracted_lowest, overall_rating, reviews, extracted_hotel_class,
 *  images[0].thumbnail (else thumbnail).
 */

interface SerpPrice {
  extracted_lowest?: number;
  extracted_display_price?: number;
  extracted_before_taxes_fees?: number;
  extracted_after_taxes_fees?: number;
}
export interface SerpProperty {
  type?: string;
  name?: string;
  description?: string;
  link?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  rate_per_night?: SerpPrice;
  total_rate?: SerpPrice;
  overall_rating?: number;
  reviews?: number;
  extracted_hotel_class?: number;
  hotel_class?: number | string;
  images?: { thumbnail?: string; original_image?: string }[];
  thumbnail?: string;
}
export interface SerpHotelsResponse {
  properties?: SerpProperty[];
  error?: string;
  search_metadata?: { status?: string };
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** The all-in price when Google gives one, else whichever price it does show. */
function pick(p: SerpPrice | undefined): number | undefined {
  const v = p?.extracted_lowest ?? p?.extracted_display_price ?? p?.extracted_after_taxes_fees ?? p?.extracted_before_taxes_fees;
  return isNum(v) && v > 0 ? Math.round(v) : undefined;
}

export function mapProperty(p: SerpProperty): LiveHotel | null {
  if (!p.name) return null;
  const stars = isNum(p.extracted_hotel_class) ? p.extracted_hotel_class : isNum(p.hotel_class) ? p.hotel_class : undefined;
  const lat = p.gps_coordinates?.latitude;
  const lon = p.gps_coordinates?.longitude;
  return {
    name: p.name,
    lat: isNum(lat) ? lat : undefined,
    lon: isNum(lon) ? lon : undefined,
    nightly: pick(p.rate_per_night),
    total: pick(p.total_rate),
    rating: isNum(p.overall_rating) ? p.overall_rating : undefined,
    reviews: isNum(p.reviews) ? p.reviews : undefined,
    thumb: p.images?.[0]?.thumbnail ?? p.thumbnail,
    stars,
    kind: p.type,
    description: p.description,
    link: p.link,
  };
}

/** Hotels from a response, without vacation rentals, and without duplicates by name. */
export function mapHotelsResponse(json: SerpHotelsResponse): LiveHotel[] {
  const seen = new Set<string>();
  const out: LiveHotel[] = [];
  for (const p of json.properties ?? []) {
    if (p.type && /rental/i.test(p.type)) continue;
    const h = mapProperty(p);
    if (!h) continue;
    const k = h.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out;
}

export function hotelsUrl(q: HotelsQuery, city: City, apiKey: string): string {
  const params = new URLSearchParams({
    engine: "google_hotels",
    q: `Hotels in ${city.name}, ${city.countryName}`,
    check_in_date: q.checkin,
    check_out_date: q.checkout,
    adults: String(q.adults),
    currency: "USD",
    gl: "us",
    hl: "en",
    api_key: apiKey,
  });
  return `https://serpapi.com/search.json?${params}`;
}

export async function serpapiHotels(q: HotelsQuery, city: City, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<LiveHotel[]> {
  const res = await fetchImpl(hotelsUrl(q, city, apiKey), { signal: AbortSignal.timeout(25000) });
  const json = (await res.json()) as SerpHotelsResponse;
  if (!res.ok || json.error) throw new Error(json.error || `SerpApi responded ${res.status}`);
  return mapHotelsResponse(json);
}
