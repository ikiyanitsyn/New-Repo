export type Cabin = "economy" | "premium" | "business" | "first";
export type FlightSource = "travelpayouts" | "serpapi" | "sample";

export interface FlightSegment {
  from: string; // airport IATA
  to: string;
  departLocal: string; // "YYYY-MM-DDTHH:mm" in the departure airport's local time
  arriveLocal?: string;
  airline: string;
  flightNumber?: string;
  durationMin?: number;
}

export interface FlightOffer {
  id: string;
  source: FlightSource;
  /** Total for all travellers, USD. */
  priceTotal: number;
  pricePerPerson: number;
  airlines: string[];
  departLocal: string;
  arriveLocal?: string;
  durationMin: number;
  stops: number;
  layovers: { airport: string; durationMin: number }[];
  segments: FlightSegment[];
  bookingUrl?: string;
}

export interface FlightQuery {
  from: string; // city code
  to: string;
  date: string; // YYYY-MM-DD
  adults: number;
  cabin: Cabin;
  directOnly: boolean;
}

export interface FlightSearchResult {
  query: FlightQuery;
  source: FlightSource;
  offers: FlightOffer[];
  notices: string[];
  fetchedAt: string;
  links: { label: string; url: string }[];
  liveAvailable: boolean;
  liveQuota?: { used: number; limit: number };
}
