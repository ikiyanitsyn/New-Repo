import type { FlightOffer } from "./types";

export type SortMode = "best" | "cheapest" | "fastest";

/** An offer is on the frontier if no other offer is both cheaper-or-equal and faster-or-equal (and strictly better in one). */
export function paretoIds(offers: FlightOffer[]): Set<string> {
  const ids = new Set<string>();
  for (const a of offers) {
    const dominated = offers.some(
      (b) =>
        b.id !== a.id &&
        b.priceTotal <= a.priceTotal &&
        b.durationMin <= a.durationMin &&
        (b.priceTotal < a.priceTotal || b.durationMin < a.durationMin),
    );
    if (!dominated) ids.add(a.id);
  }
  return ids;
}

/**
 * Balanced score in [0, ~1.1]; lower is better.
 * `priceWeight` 1 = care only about price, 0 = care only about time.
 * Each extra stop adds a small penalty for the hassle it brings.
 */
export function balanceScore(o: FlightOffer, offers: FlightOffer[], priceWeight: number): number {
  const prices = offers.map((x) => x.priceTotal);
  const durs = offers.map((x) => x.durationMin);
  const norm = (v: number, arr: number[]) => {
    const lo = Math.min(...arr), hi = Math.max(...arr);
    return hi === lo ? 0 : (v - lo) / (hi - lo);
  };
  return priceWeight * norm(o.priceTotal, prices) + (1 - priceWeight) * norm(o.durationMin, durs) + 0.03 * o.stops;
}

export function sortOffers(offers: FlightOffer[], mode: SortMode, priceWeight = 0.5): FlightOffer[] {
  const list = [...offers];
  if (mode === "cheapest") return list.sort((a, b) => a.priceTotal - b.priceTotal || a.durationMin - b.durationMin);
  if (mode === "fastest") return list.sort((a, b) => a.durationMin - b.durationMin || a.priceTotal - b.priceTotal);
  const scores = new Map(list.map((o) => [o.id, balanceScore(o, offers, priceWeight)]));
  return list.sort((a, b) => scores.get(a.id)! - scores.get(b.id)! || a.priceTotal - b.priceTotal);
}

export function filterOffers(offers: FlightOffer[], directOnly: boolean): FlightOffer[] {
  return directOnly ? offers.filter((o) => o.stops === 0) : offers;
}
