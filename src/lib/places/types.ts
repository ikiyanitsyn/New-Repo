export type PlaceCategory = "sleep" | "see" | "do" | "eat" | "drink" | "buy";

export const CATEGORY_ORDER: PlaceCategory[] = ["sleep", "see", "do", "eat", "drink", "buy"];

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  sleep: "Stay",
  see: "See",
  do: "Do",
  eat: "Eat",
  drink: "Drink",
  buy: "Shop",
};

export interface Place {
  id: string;
  category: PlaceCategory;
  name: string;
  alt?: string; // alternative or local-language name
  lat?: number;
  lon?: number;
  description?: string;
  address?: string;
  directions?: string;
  hours?: string;
  price?: string;
  checkin?: string;
  checkout?: string;
  phone?: string;
  url?: string;
  image?: string; // Wikimedia Commons file name
  /** Ready-to-use photo URL (from the guide's image or the place's Wikipedia article). */
  thumb?: string;
  wikipedia?: string;
  /** Price tier for stays and food, from the guide's Budget / Mid-range / Splurge headings. */
  tier?: "Budget" | "Mid-range" | "Splurge";
  /** Sub-heading the listing sits under, e.g. "Temples", or the district name. */
  group?: string;
  district?: string;
}

export interface PlacesResult {
  city: string;
  source: "wikivoyage";
  articleTitle: string;
  articleUrl: string;
  /** Wide photo for the top of the city screen. */
  banner?: string;
  places: Place[];
  fetchedAt: string;
  error?: string;
}

/** Traveller's comfort level, from the concierge's preferences. */
export type Comfort = "Good value" | "Comfortable" | "Luxury";

export interface PlaceReview {
  author: string;
  /** Link to the author's profile at the provider (required attribution for some providers). */
  authorUrl?: string;
  /** Stars the reviewer gave, 1 to 5. */
  rating?: number;
  /** Human-readable age, e.g. "2 months ago". */
  when?: string;
  /** ISO date, when the provider gives one. */
  publishTime?: string;
  text: string;
}

export interface PlaceRating {
  /** Average stars, 1 to 5. */
  rating?: number;
  /** Number of ratings behind the average. */
  count?: number;
  /** 0 free, 1 inexpensive ... 4 very expensive. */
  priceLevel?: 0 | 1 | 2 | 3 | 4;
  /** The place's page at the provider (link-back for attribution). */
  url?: string;
  reviews: PlaceReview[];
}

export interface RatingsProviderInfo {
  id: string;
  /** Name to credit, e.g. "Google Maps". */
  name: string;
  /**
   * Whether the provider's terms let its ratings appear on a non-provider map.
   * Google's terms don't allow Google Maps content on other maps, so stay pins
   * show the guide's price instead.
   */
  showOnMap: boolean;
}

export interface RatingsResult {
  /** Null when no ratings provider is configured; the guide works without one. */
  provider: RatingsProviderInfo | null;
  /** By guide place id. Null: looked up, no confident match. Missing: not looked up. */
  ratings: Record<string, PlaceRating | null>;
  /** Why some places were skipped, e.g. the daily safety limit. */
  note?: string;
}
