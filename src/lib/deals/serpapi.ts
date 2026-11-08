import { getCity, type Region } from "../cities";
import { cityForIata } from "./travelpayouts";
import type { DealsQuery, LiveDeal } from "./types";

/**
 * SerpApi Google Travel Explore engine: destinations with flight prices from
 * an origin, as on google.com/travel/explore. Live, so it spends one search
 * from the small free monthly quota; the app only calls it from an explicit
 * button and caches the answer.
 * Docs (checked live 2026-11-08): https://serpapi.com/google-travel-explore-api
 *   GET https://serpapi.com/search.json?engine=google_travel_explore&departure_id=JFK,EWR,LGA
 *       [&arrival_area_id=<kgmid>][&month=1..12][&travel_duration=1|2|3][&travel_class=1..4][&adults=n]
 *   → { destinations: [{ name, country, destination_airport: { code }, start_date, end_date,
 *        flight_price, number_of_stops, airline, flight_duration, link }] }
 */

// Freebase IDs (Wikidata P646), checked live: Q48 Asia, Q46 Europe, Q7204 Middle East.
const AREA: Partial<Record<Region, string>> = {
  "East Asia": "/m/0j0k",
  "Southeast Asia": "/m/0j0k",
  Europe: "/m/02j9z",
  "Middle East": "/m/04wsz",
};

const TRAVEL_CLASS = { economy: "1", premium: "2", business: "3", first: "4" } as const;

interface SerpDestination {
  name?: string;
  country?: string;
  destination_airport?: { code?: string };
  start_date?: string;
  end_date?: string;
  flight_price?: number;
  number_of_stops?: number;
  airline?: string;
  flight_duration?: number;
  link?: string;
}

interface SerpExplore {
  destinations?: SerpDestination[];
  error?: string;
}

export function exploreParams(q: DealsQuery, apiKey: string, today = new Date()): URLSearchParams {
  const home = getCity(q.from);
  const params = new URLSearchParams({
    engine: "google_travel_explore",
    departure_id: home.airports.join(","),
    currency: "USD",
    gl: "us",
    hl: "en",
    travel_class: TRAVEL_CLASS[q.cabin],
    adults: String(q.adults),
    api_key: apiKey,
  });
  const area = q.to ? AREA[getCity(q.to).region] : AREA["East Asia"];
  if (area) params.set("arrival_area_id", area);
  // Google only explores the next six months; outside that, let it pick ("all months").
  if (q.month) {
    const ahead = (Number(q.month.slice(0, 4)) - today.getUTCFullYear()) * 12 + Number(q.month.slice(5, 7)) - 1 - today.getUTCMonth();
    if (ahead >= 0 && ahead < 6) params.set("month", String(Number(q.month.slice(5, 7))));
  }
  if (q.nights) params.set("travel_duration", q.nights <= 3 ? "1" : q.nights <= 10 ? "2" : "3");
  return params;
}

export function parseExplore(json: SerpExplore): LiveDeal[] {
  return (json.destinations ?? [])
    .filter((d) => typeof d.flight_price === "number" && d.flight_price > 0 && d.name)
    .map((d) => {
      const code = d.destination_airport?.code;
      const city = code ? cityForIata(code) : undefined;
      return {
        name: d.name!,
        country: d.country,
        to: city && city.country !== "US" ? city.code : undefined,
        airport: code,
        price: Math.round(d.flight_price!),
        startDate: d.start_date,
        endDate: d.end_date,
        airline: d.airline,
        stops: d.number_of_stops,
        durationMin: d.flight_duration,
        link: d.link?.startsWith("https://") ? d.link : undefined,
      };
    })
    .sort((a, b) => a.price - b.price);
}

export async function exploreDeals(q: DealsQuery, apiKey: string, fetcher: typeof fetch = fetch): Promise<LiveDeal[]> {
  const res = await fetcher(`https://serpapi.com/search.json?${exploreParams(q, apiKey)}`, { signal: AbortSignal.timeout(25000) });
  const json = (await res.json()) as SerpExplore;
  if (!res.ok || json.error) throw new Error(json.error || `SerpApi responded ${res.status}`);
  return parseExplore(json);
}
