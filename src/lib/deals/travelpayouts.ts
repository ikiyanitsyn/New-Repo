import { CITIES, flightCodeOf, getCity, type City } from "../cities";
import type { MonthPrice, PopularDeal } from "./types";

/**
 * Travelpayouts (Aviasales) Data API, for price analytics on the home page.
 * Prices are cached from recent searches by Aviasales users (hours to days
 * old), so they are trends, not bookable quotes.
 *
 * Endpoints (docs: https://support.travelpayouts.com/hc/en-us/articles/203956163
 * — Cloudflare blocks the sandbox, so shapes were confirmed from the docs mirror
 * at https://travelpayouts-data-api.readthedocs.io/ and the endpoints checked live
 * to exist: each answers 401 without a token, 404 for an unknown path):
 *  - GET /aviasales/v3/grouped_prices?origin&destination&currency=usd&group_by=month
 *    → { success, data: { "YYYY-MM": { price, airline, transfers, departure_at, return_at, link } } }
 *  - GET /v1/prices/monthly?origin&destination&currency=usd  (older; same keyed-by-month shape)
 *    used as a fallback when grouped_prices fails.
 *  - GET /v1/city-directions?origin&currency=usd  ("popular directions from a city")
 *    → { success, data: { "<IATA>": { origin, destination, price, transfers, airline, flight_number, departure_at, return_at } } }
 * The token goes in the X-Access-Token header, as in src/lib/flights/travelpayouts.ts.
 */

const BASE = "https://api.travelpayouts.com";

interface TpRow {
  origin?: string;
  destination?: string;
  price?: number;
  value?: number;
  airline?: string;
  transfers?: number;
  number_of_changes?: number;
  departure_at?: string;
  depart_date?: string;
  return_at?: string;
  return_date?: string;
  link?: string;
}

interface TpEnvelope {
  success?: boolean;
  data?: Record<string, TpRow> | TpRow[];
  error?: string | null;
}

async function get(path: string, params: Record<string, string>, token: string, fetcher: typeof fetch): Promise<TpEnvelope> {
  const res = await fetcher(`${BASE}${path}?${new URLSearchParams(params)}`, {
    headers: { "X-Access-Token": token, "Accept-Encoding": "gzip" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Travelpayouts responded ${res.status}`);
  const json = (await res.json()) as TpEnvelope;
  if (json.success === false) throw new Error(json.error || "Travelpayouts returned an error");
  return json;
}

const rows = (data: TpEnvelope["data"]): [string, TpRow][] =>
  !data ? [] : Array.isArray(data) ? data.map((r, i) => [String(i), r]) : Object.entries(data);

const priceOf = (r: TpRow) => (typeof r.price === "number" ? r.price : typeof r.value === "number" ? r.value : NaN);
const aviasales = (link?: string) => (link ? `https://www.aviasales.com${link.startsWith("/") ? "" : "/"}${link}` : undefined);

/** Parse a keyed-by-month response (grouped_prices or prices/monthly) into month prices. */
export function parseMonthly(json: TpEnvelope): MonthPrice[] {
  const out: MonthPrice[] = [];
  for (const [key, r] of rows(json.data)) {
    const month = /^\d{4}-\d{2}/.test(key) ? key.slice(0, 7) : (r.departure_at ?? r.depart_date ?? "").slice(0, 7);
    const price = priceOf(r);
    if (!/^\d{4}-\d{2}$/.test(month) || !(price > 0)) continue;
    out.push({
      month,
      price: Math.round(price),
      airline: r.airline,
      transfers: r.transfers ?? r.number_of_changes,
      departureAt: (r.departure_at ?? r.depart_date)?.slice(0, 10),
      returnAt: (r.return_at ?? r.return_date)?.slice(0, 10),
      link: aviasales(r.link),
    });
  }
  // One price per month (the cheapest), in date order.
  const best = new Map<string, MonthPrice>();
  for (const m of out) if (!best.has(m.month) || m.price < best.get(m.month)!.price) best.set(m.month, m);
  return [...best.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Catalog city for an IATA city or airport code, if we have it. */
export function cityForIata(code: string): City | undefined {
  const c = code.toUpperCase();
  return CITIES.find((x) => x.code === c) ?? CITIES.find((x) => x.flightCode === c) ?? CITIES.find((x) => x.airports.includes(c));
}

/** Parse "popular directions" into catalog destinations, cheapest first. */
export function parsePopular(json: TpEnvelope, from: string): PopularDeal[] {
  const out: PopularDeal[] = [];
  for (const [key, r] of rows(json.data)) {
    const city = cityForIata(r.destination ?? key);
    const price = priceOf(r);
    if (!city || city.code === from || city.country === "US" || !(price > 0)) continue;
    if (out.some((d) => d.to === city.code)) continue;
    out.push({
      to: city.code,
      price: Math.round(price),
      airline: r.airline,
      transfers: r.transfers ?? r.number_of_changes,
      departureAt: (r.departure_at ?? r.depart_date)?.slice(0, 10),
      returnAt: (r.return_at ?? r.return_date)?.slice(0, 10),
      link: aviasales(r.link),
    });
  }
  return out.sort((a, b) => a.price - b.price);
}

export async function monthlyPrices(from: string, to: string, token: string, fetcher: typeof fetch = fetch): Promise<MonthPrice[]> {
  const origin = flightCodeOf(getCity(from));
  const destination = flightCodeOf(getCity(to));
  try {
    return parseMonthly(await get("/aviasales/v3/grouped_prices", { origin, destination, currency: "usd", group_by: "month" }, token, fetcher));
  } catch {
    return parseMonthly(await get("/v1/prices/monthly", { origin, destination, currency: "usd" }, token, fetcher));
  }
}

export async function popularFrom(from: string, token: string, fetcher: typeof fetch = fetch): Promise<PopularDeal[]> {
  const origin = flightCodeOf(getCity(from));
  return parsePopular(await get("/v1/city-directions", { origin, currency: "usd" }, token, fetcher), from);
}
