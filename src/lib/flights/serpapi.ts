import { getCity } from "../cities";
import type { FlightOffer, FlightQuery } from "./types";

/**
 * SerpApi Google Flights engine — real-time Google Flights results.
 * Free plan: a small monthly search allowance, so the app only calls it
 * when the traveller presses "Check live prices", and caches results.
 * Docs: https://serpapi.com/google-flights-api
 */

interface SerpAirport { id: string; name?: string; time: string }
interface SerpSegment {
  departure_airport: SerpAirport;
  arrival_airport: SerpAirport;
  duration: number;
  airline: string;
  flight_number?: string;
}
interface SerpItinerary {
  flights: SerpSegment[];
  layovers?: { duration: number; id: string; name?: string }[];
  total_duration: number;
  price?: number;
  booking_token?: string;
}
interface SerpResponse {
  best_flights?: SerpItinerary[];
  other_flights?: SerpItinerary[];
  search_metadata?: { google_flights_url?: string; status?: string };
  error?: string;
}

const TRAVEL_CLASS = { economy: "1", premium: "2", business: "3", first: "4" } as const;

const toLocal = (t: string) => t.replace(" ", "T").slice(0, 16);

export async function serpapiSearch(q: FlightQuery, apiKey: string): Promise<{ offers: FlightOffer[]; notices: string[] }> {
  const from = getCity(q.from);
  const to = getCity(q.to);
  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: from.airports.join(","),
    arrival_id: to.airports.join(","),
    outbound_date: q.date,
    type: "2", // one way; each leg of the trip is searched separately
    travel_class: TRAVEL_CLASS[q.cabin],
    adults: String(q.adults),
    currency: "USD",
    hl: "en",
    gl: "us",
    api_key: apiKey,
  });
  if (q.directOnly) params.set("stops", "1"); // 1 = nonstop only

  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(25000) });
  const json = (await res.json()) as SerpResponse;
  if (!res.ok || json.error) throw new Error(json.error || `SerpApi responded ${res.status}`);

  const all = [...(json.best_flights ?? []), ...(json.other_flights ?? [])].filter((it) => typeof it.price === "number");
  const gfUrl = json.search_metadata?.google_flights_url;

  const offers: FlightOffer[] = all.map((it, i) => {
    const first = it.flights[0];
    const last = it.flights[it.flights.length - 1];
    const price = it.price!;
    return {
      id: `serp-${i}-${first.flight_number ?? i}`,
      source: "serpapi",
      // Google Flights prices cover all passengers in the search.
      priceTotal: price,
      pricePerPerson: Math.round(price / q.adults),
      airlines: [...new Set(it.flights.map((s) => s.airline))],
      departLocal: toLocal(first.departure_airport.time),
      arriveLocal: toLocal(last.arrival_airport.time),
      durationMin: it.total_duration,
      stops: it.flights.length - 1,
      layovers: (it.layovers ?? []).map((l) => ({ airport: l.id, durationMin: l.duration })),
      segments: it.flights.map((s) => ({
        from: s.departure_airport.id,
        to: s.arrival_airport.id,
        departLocal: toLocal(s.departure_airport.time),
        arriveLocal: toLocal(s.arrival_airport.time),
        airline: s.airline,
        flightNumber: s.flight_number,
        durationMin: s.duration,
      })),
      bookingUrl: gfUrl,
    };
  });
  return { offers, notices: [] };
}
