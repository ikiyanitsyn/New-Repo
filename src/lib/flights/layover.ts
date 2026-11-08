import type { FlightOffer } from "./types";

/** Stops and layover preferences. Applied client-side to every provider, and sent to SerpApi where it supports them. */
export interface LayoverFilter {
  /** 0 = nonstop only, 1 = at most one stop, null = any. */
  maxStops: 0 | 1 | null;
  /** Hours; null = no limit. Every layover on an itinerary must fit the range. */
  minHours: number | null;
  maxHours: number | null;
  /** Preferred connection airports; when set, every connection must be one of them. */
  airports: string[];
}

export const NO_LAYOVER_FILTER: LayoverFilter = { maxStops: null, minHours: null, maxHours: null, airports: [] };

export function isDefaultFilter(f: LayoverFilter): boolean {
  return f.maxStops === null && f.minHours === null && f.maxHours === null && f.airports.length === 0;
}

/**
 * Itineraries whose layovers are unknown (cached Travelpayouts fares list only the
 * stop count) pass the layover-length and airport rules rather than vanish.
 */
export function applyLayoverFilter(offers: FlightOffer[], f: LayoverFilter): FlightOffer[] {
  return offers.filter((o) => {
    if (f.maxStops !== null && o.stops > f.maxStops) return false;
    if (o.layovers.length === 0) return true;
    for (const l of o.layovers) {
      if (f.minHours !== null && l.durationMin < f.minHours * 60) return false;
      if (f.maxHours !== null && l.durationMin > f.maxHours * 60) return false;
      if (f.airports.length > 0 && !f.airports.includes(l.airport)) return false;
    }
    return true;
  });
}

/** Connection airports found in the results, most common first (for the preferred-airport chips). */
export function connectionAirports(offers: FlightOffer[]): { code: string; count: number }[] {
  const n = new Map<string, number>();
  for (const o of offers) for (const code of new Set(o.layovers.map((l) => l.airport))) n.set(code, (n.get(code) ?? 0) + 1);
  return [...n].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

/**
 * SerpApi Google Flights parameters for these preferences.
 * `stops`: 1 nonstop only, 2 one stop or fewer (0 = any). `layover_duration`: "min,max" in minutes.
 * SerpApi can only exclude connecting airports (`exclude_conns`), not prefer them, so airports stay client-side.
 */
export function serpLayoverParams(f: LayoverFilter): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.maxStops === 0) p.stops = "1";
  else if (f.maxStops === 1) p.stops = "2";
  if (f.minHours !== null || f.maxHours !== null) {
    p.layover_duration = `${Math.round((f.minHours ?? 0) * 60)},${Math.round((f.maxHours ?? 24) * 60)}`;
  }
  return p;
}

export function describeFilter(f: LayoverFilter): string {
  const parts: string[] = [];
  parts.push(f.maxStops === 0 ? "Nonstop" : f.maxStops === 1 ? "Up to 1 stop" : "Any stops");
  if (f.minHours !== null || f.maxHours !== null) {
    const { minHours: lo, maxHours: hi } = f;
    parts.push(`layovers ${lo !== null && hi !== null ? `${lo}–${hi} h` : lo !== null ? `${lo}+ h` : `up to ${hi} h`}`);
  }
  if (f.airports.length) parts.push(`via ${f.airports.join(", ")}`);
  return parts.join(" · ");
}
