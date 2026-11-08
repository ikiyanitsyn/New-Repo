/** One hotel from the live price search (SerpApi Google Hotels), reduced to what the app uses. */
export interface LiveHotel {
  name: string;
  lat?: number;
  lon?: number;
  /** USD for one night, the lowest all-in price Google shows (rate_per_night.extracted_lowest). */
  nightly?: number;
  /** USD for the whole stay (total_rate.extracted_lowest). */
  total?: number;
  /** Stars guests gave, 1 to 5 (overall_rating). */
  rating?: number;
  /** Number of guest reviews (reviews). */
  reviews?: number;
  /** Small photo (images[0].thumbnail, else thumbnail). */
  thumb?: string;
  /** Hotel star class, e.g. 4 (extracted_hotel_class). */
  stars?: number;
  /** "hotel" or "vacation rental". */
  kind?: string;
  /** Google's one-line description. */
  description?: string;
  /** The hotel's own page or Google's booking link (link). */
  link?: string;
}

export interface HotelsQuery {
  /** City code from src/lib/cities.ts. */
  city: string;
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  adults: number;
}

export interface HotelsResult {
  query: HotelsQuery;
  source: "serpapi_google_hotels";
  currency: "USD";
  hotels: LiveHotel[];
  /** ISO time the prices were fetched (kept when served from the 12 hour cache). */
  fetchedAt: string;
  quota: { used: number; limit: number };
}

export type HotelsErrorCode = "no_key" | "quota" | "bad_request" | "upstream";

export interface HotelsStatus {
  /** A SerpApi key is configured. */
  available: boolean;
  quota: { used: number; limit: number };
}
