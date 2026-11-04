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
