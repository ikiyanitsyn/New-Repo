import type { MonthPrice } from "./types";

/**
 * Honest labels for month-by-month fares. The "average" is the plain mean of
 * the monthly cheapest fares we actually got back, and the label says how many
 * months that covers when it is less than a year, so it never overstates.
 */

export interface MonthStats {
  cheapest: MonthPrice;
  /** Mean of the monthly cheapest fares, rounded to whole dollars. */
  average: number;
  /** How far the cheapest month is below the average, in whole percent (negative = above). */
  pctBelow: number;
  /** Months with a price. */
  count: number;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;

const valid = (m: MonthPrice) => /^\d{4}-\d{2}$/.test(m.month) && Number.isFinite(m.price) && m.price > 0;

/** Average and cheapest month; null when there are fewer than two months to compare. */
export function monthStats(months: MonthPrice[]): MonthStats | null {
  const list = months.filter(valid);
  if (list.length < 2) return null;
  const average = list.reduce((sum, m) => sum + m.price, 0) / list.length;
  const cheapest = list.reduce((a, b) => (b.price < a.price ? b : a));
  return { cheapest, average: Math.round(average), pctBelow: pctBelow(cheapest.price, average), count: list.length };
}

/** Whole-percent difference from an average: 500 vs 610 → 18 (below); 700 vs 610 → -15 (above). */
export function pctBelow(price: number, average: number): number {
  if (!(average > 0)) return 0;
  return Math.round(((average - price) / average) * 100);
}

/** "the yearly average" only when we have (nearly) a year of months; otherwise say how many. */
export function averagePhrase(count: number): string {
  return count >= 10 ? "the yearly average" : `the average of the ${count} months with prices`;
}

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** "From $612 in April, about 18% below the yearly average". */
export function cheapestMonthLabel(stats: MonthStats): string {
  const head = `From ${usd(stats.cheapest.price)} in ${monthName(stats.cheapest.month)}`;
  return `${head}, ${comparison(stats.pctBelow, stats.count)}`;
}

/** How one month compares, e.g. for the month chosen in the search. */
export function monthLabel(month: MonthPrice, stats: MonthStats): string {
  const pct = pctBelow(month.price, stats.average);
  return `${usd(month.price)} in ${monthName(month.month)}, ${comparison(pct, stats.count)}`;
}

function comparison(pct: number, count: number): string {
  const avg = averagePhrase(count);
  if (Math.abs(pct) < 3) return `about the same as ${avg}`;
  return pct > 0 ? `about ${pct}% below ${avg}` : `about ${-pct}% above ${avg}`;
}

/** Months sorted by date, so a strip of bars reads left to right. */
export const byMonth = (months: MonthPrice[]) => months.filter(valid).sort((a, b) => a.month.localeCompare(b.month));
