import type { Cabin } from "../flights/types";

export type DealSource = "travelpayouts" | "serpapi" | "sample";

/** The cheapest fare seen for one departure month. */
export interface MonthPrice {
  month: string; // YYYY-MM
  price: number; // USD per person
  airline?: string;
  transfers?: number;
  departureAt?: string;
  returnAt?: string;
  link?: string;
}

/** A popular destination from the origin, with the cheapest recent fare. */
export interface PopularDeal {
  to: string; // catalog city code
  price: number;
  departureAt?: string;
  returnAt?: string;
  airline?: string;
  transfers?: number;
  link?: string;
}

/** A live destination idea from Google Travel Explore (via SerpApi). */
export interface LiveDeal {
  name: string;
  country?: string;
  /** Catalog city code, when the destination is in our catalog. */
  to?: string;
  airport?: string;
  price: number;
  startDate?: string;
  endDate?: string;
  airline?: string;
  stops?: number;
  durationMin?: number;
  link?: string;
}

export interface DealsQuery {
  from: string; // catalog city code (US)
  to?: string; // catalog city code
  /** Preferred departure month (YYYY-MM), used to steer the live search. */
  month?: string;
  nights?: number;
  adults: number;
  cabin: Cabin;
}

export interface DealsResult {
  source: DealSource;
  query: DealsQuery;
  /** Cheapest fare by departure month, for from → to. */
  months: MonthPrice[];
  popular: PopularDeal[];
  live?: LiveDeal[];
  liveSource?: DealSource;
  notices: string[];
  liveAvailable: boolean;
  liveQuota: { used: number; limit: number };
  fetchedAt: string;
}
