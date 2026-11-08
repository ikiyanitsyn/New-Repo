import { getCity } from "../cities";
import { distanceKm } from "../geo";
import type { LiveDeal, MonthPrice, PopularDeal } from "./types";

const addMonths = (ym: string, n: number) =>
  new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7);

/**
 * Made-up but plausible fares for when no API key is set. Every card built
 * from these is labelled "Sample" in the interface.
 */

// Rough seasonality for long-haul economy from the US: summer and Christmas high, Jan–Feb low.
const SEASON = [0.86, 0.82, 0.92, 1.0, 0.98, 1.12, 1.24, 1.2, 0.95, 0.97, 0.9, 1.15];

const base = (from: string, to: string) => 180 + distanceKm(getCity(from), getCity(to)) * 0.07;

export function sampleMonths(from: string, to: string, today = new Date()): MonthPrice[] {
  const b = base(from, to);
  const start = today.toISOString().slice(0, 7);
  return Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(start, i);
    const m = Number(month.slice(5, 7)) - 1;
    return { month, price: Math.round((b * SEASON[m]) / 5) * 5 };
  });
}

const POPULAR = ["TYO", "SEL", "HKG", "BKK", "LON", "PAR", "LIS", "REK", "IST", "BJS"];

export function samplePopular(from: string): PopularDeal[] {
  return POPULAR.filter((c) => c !== from)
    .map((to) => ({ to, price: Math.round((base(from, to) * 0.92) / 5) * 5 }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 6);
}

export function sampleLive(from: string): LiveDeal[] {
  return samplePopular(from).slice(0, 4).map((d) => {
    const c = getCity(d.to);
    return { name: c.name, country: c.countryName, to: d.to, airport: c.airports[0], price: Math.round(d.price * 1.08), stops: 1 };
  });
}
