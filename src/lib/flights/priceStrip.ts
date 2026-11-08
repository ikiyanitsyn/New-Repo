/** One day on the price strip: the lowest cached fare per person for that date, or null when none is known. */
export interface DayPrice {
  date: string;
  price: number | null;
}

/** A dated fare from a month query (Travelpayouts `departure_at` is an ISO date-time). */
export interface DatedFare {
  departure_at: string;
  price: number;
}

const addDays = (date: string, n: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The months (YYYY-MM) a window of `radius` days around `date` touches: one, or two across a month end. */
export function monthsAround(date: string, radius = 3): string[] {
  return [...new Set([addDays(date, -radius).slice(0, 7), date.slice(0, 7), addDays(date, radius).slice(0, 7)])];
}

/**
 * Picks the lowest price on each of the 2×radius+1 days around `date` from month-wide fares.
 * Days with no fare stay `null` so the strip can show a dash.
 */
export function pickDayPrices(fares: DatedFare[], date: string, radius = 3): DayPrice[] {
  const best = new Map<string, number>();
  for (const f of fares) {
    const day = f.departure_at.slice(0, 10);
    if (!(f.price > 0)) continue;
    if (!best.has(day) || f.price < best.get(day)!) best.set(day, f.price);
  }
  return Array.from({ length: radius * 2 + 1 }, (_, i) => {
    const d = addDays(date, i - radius);
    return { date: d, price: best.get(d) ?? null };
  });
}

/** Index of the cheapest day with a price, or -1. */
export function cheapestDayIndex(days: DayPrice[]): number {
  let at = -1;
  days.forEach((d, i) => {
    if (d.price !== null && (at < 0 || d.price < days[at].price!)) at = i;
  });
  return at;
}
