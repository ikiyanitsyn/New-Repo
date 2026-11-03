import { getCity } from "../cities";
import { airlineName } from "./airlines";
import type { FlightOffer, FlightQuery } from "./types";

/**
 * Travelpayouts (Aviasales) Data API — free with an affiliate token.
 * Prices are cached from recent searches by Aviasales users, so they are
 * fresh-ish (hours to days old) rather than live, and economy only.
 * Docs: https://support.travelpayouts.com/hc/en-us/articles/203956163
 */

interface TpItem {
  origin: string;
  destination: string;
  origin_airport: string;
  destination_airport: string;
  price: number;
  airline: string;
  flight_number: string | number;
  departure_at: string; // ISO with offset
  transfers: number;
  duration?: number;
  duration_to?: number;
  link?: string;
}

interface TpResponse {
  success: boolean;
  data: TpItem[];
  currency?: string;
  error?: string;
}

async function call(q: FlightQuery, departureAt: string, token: string): Promise<TpItem[]> {
  const params = new URLSearchParams({
    origin: q.from,
    destination: q.to,
    departure_at: departureAt,
    one_way: "true",
    direct: String(q.directOnly),
    currency: "usd",
    sorting: "price",
    unique: "false",
    limit: "30",
    page: "1",
  });
  const res = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`, {
    headers: { "X-Access-Token": token, "Accept-Encoding": "gzip" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Travelpayouts responded ${res.status}`);
  const json = (await res.json()) as TpResponse;
  if (!json.success) throw new Error(json.error || "Travelpayouts returned an error");
  return json.data ?? [];
}

export async function travelpayoutsSearch(
  q: FlightQuery,
  token: string,
): Promise<{ offers: FlightOffer[]; notices: string[] }> {
  const notices: string[] = [];
  let items = await call(q, q.date, token);

  if (items.length === 0) {
    // Cached data is sparse for exact dates; widen to the month and keep ±3 days.
    const month = q.date.slice(0, 7);
    const target = new Date(q.date + "T00:00:00Z").getTime();
    items = (await call(q, month, token)).filter(
      (it) => Math.abs(new Date(it.departure_at.slice(0, 10) + "T00:00:00Z").getTime() - target) <= 3 * 86400000,
    );
    if (items.length) notices.push("No cached fares for this exact date, so these are from within 3 days of it.");
  }

  const toCity = getCity(q.to);
  const offers: FlightOffer[] = items.map((it, i) => {
    const durationMin = it.duration_to ?? it.duration ?? 0;
    const name = airlineName(it.airline);
    return {
      id: `tp-${i}-${it.airline}${it.flight_number}`,
      source: "travelpayouts",
      pricePerPerson: it.price,
      priceTotal: it.price * q.adults,
      airlines: [name],
      departLocal: it.departure_at.slice(0, 16),
      durationMin,
      stops: it.transfers,
      layovers: [],
      segments: [
        {
          from: it.origin_airport,
          to: it.destination_airport || toCity.airports[0],
          departLocal: it.departure_at.slice(0, 16),
          airline: name,
          flightNumber: `${it.airline} ${it.flight_number}`,
        },
      ],
      bookingUrl: it.link ? `https://www.aviasales.com${it.link}` : undefined,
    };
  });

  if (q.cabin !== "economy") notices.push("Cached fares are economy only. Check live prices for other cabins.");
  if (q.adults > 1) notices.push(`Totals are the per-person fare × ${q.adults}.`);
  return { offers: offers.filter((o) => o.durationMin > 0), notices };
}
