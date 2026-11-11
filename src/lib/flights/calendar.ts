import "server-only";
import { flightCodeOf, getCity } from "../cities";
import { addDays } from "../trip";
import { sampleOffers } from "./sample";
import { monthsAround, nearestDayPrices, pickDayPrices, type DatedFare, type DayPrice } from "./priceStrip";
import { travelpayoutsMonth } from "./travelpayouts";
import type { Cabin } from "./types";

export interface CalendarQuery {
  from: string;
  to: string;
  date: string;
  adults: number;
  cabin: Cabin;
}

export interface CalendarResult {
  source: "travelpayouts" | "sample";
  /** Seven days around the leg date; `price` is the lowest total for all travellers. */
  days: DayPrice[];
  /** When the leg date has no fare: the closest dates that do (nearest first). */
  nearby?: DayPrice[];
  notices: string[];
}

/** Month fares are cached for 12 h in memory, shared by every leg that touches the route and month. */
const TTL = 12 * 3600_000;
const monthCache = new Map<string, { at: number; fares: DatedFare[] }>();

async function monthFares(origin: string, destination: string, month: string, token: string): Promise<DatedFare[]> {
  const k = `${origin}|${destination}|${month}`;
  const hit = monthCache.get(k);
  if (hit && Date.now() - hit.at < TTL) return hit.fares;
  const fares = await travelpayoutsMonth(origin, destination, month, token);
  monthCache.set(k, { at: Date.now(), fares });
  return fares;
}

/** Sample generator: the cheapest invented fare on each day (deterministic per route and date). */
function sampleDays(q: CalendarQuery): DayPrice[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(q.date, i - 3);
    const prices = sampleOffers({ ...q, date, directOnly: false }).map((o) => o.priceTotal);
    return { date, price: prices.length ? Math.min(...prices) : null };
  });
}

export async function priceCalendar(q: CalendarQuery): Promise<CalendarResult> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    return { source: "sample", days: sampleDays(q), notices: ["Sample prices. Add a Travelpayouts token for real ones."] };
  }
  try {
    const origin = flightCodeOf(getCity(q.from));
    const destination = flightCodeOf(getCity(q.to));
    const near = monthsAround(q.date);
    const fares = (await Promise.all(near.map((m) => monthFares(origin, destination, m, token)))).flat();
    // Cached fares are economy, per person; show the total for the party.
    const days = pickDayPrices(fares, q.date).map((d) => ({ ...d, price: d.price === null ? null : d.price * q.adults }));
    const notices = q.cabin !== "economy" ? ["Day prices are economy fares."] : [];
    // No fare on the leg date: look up to three weeks either side for the closest dates that have one.
    let nearby: DayPrice[] | undefined;
    if (days[3]?.price === null) {
      const wider = monthsAround(q.date, 21).filter((m) => !near.includes(m));
      const more = (await Promise.all(wider.map((m) => monthFares(origin, destination, m, token).catch(() => [] as DatedFare[])))).flat();
      nearby = nearestDayPrices([...fares, ...more], q.date, 21, 3, new Date().toISOString().slice(0, 10)).map((d) => ({ ...d, price: d.price! * q.adults }));
    }
    return { source: "travelpayouts", days, ...(nearby?.length ? { nearby } : {}), notices };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price calendar failed.";
    return { source: "sample", days: sampleDays(q), notices: [`${message} Showing sample prices instead.`] };
  }
}
