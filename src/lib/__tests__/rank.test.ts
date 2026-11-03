import { describe, expect, it } from "vitest";
import { filterOffers, paretoIds, sortOffers } from "../flights/rank";
import type { FlightOffer } from "../flights/types";

const offer = (id: string, price: number, dur: number, stops = 1): FlightOffer => ({
  id, source: "sample", priceTotal: price, pricePerPerson: price, airlines: ["X"], departLocal: "2027-04-08T10:00",
  durationMin: dur, stops, layovers: [], segments: [],
});

const offers = [
  offer("cheap-slow", 600, 1500, 2),
  offer("mid", 800, 1000, 1),
  offer("fast-pricey", 1400, 830, 0),
  offer("dominated", 900, 1200, 1), // worse than "mid" on both
];

describe("ranking", () => {
  it("sorts cheapest and fastest", () => {
    expect(sortOffers(offers, "cheapest")[0].id).toBe("cheap-slow");
    expect(sortOffers(offers, "fastest")[0].id).toBe("fast-pricey");
  });

  it("finds the cheap-and-fast frontier", () => {
    expect([...paretoIds(offers)].sort()).toEqual(["cheap-slow", "fast-pricey", "mid"]);
  });

  it("best balance follows the price/time slider", () => {
    expect(sortOffers(offers, "best", 0.5)[0].id).toBe("mid");
    expect(sortOffers(offers, "best", 1)[0].id).toBe("cheap-slow");
    expect(sortOffers(offers, "best", 0)[0].id).toBe("fast-pricey");
  });

  it("never ranks a dominated offer first", () => {
    for (const w of [0, 0.25, 0.5, 0.75, 1]) expect(sortOffers(offers, "best", w)[0].id).not.toBe("dominated");
  });

  it("filters to nonstop", () => {
    expect(filterOffers(offers, true).map((o) => o.id)).toEqual(["fast-pricey"]);
  });
});
