import { afterEach, describe, expect, it, vi } from "vitest";
import { nearestDayPrices } from "../flights/priceStrip";
import { travelpayoutsSearch } from "../flights/travelpayouts";
import { approxUsd } from "../places/display";
import { keepOwnItems } from "../planAdd";
import type { PlanResponse } from "../ai/schema";

const fare = (date: string, price: number) => ({ departure_at: `${date}T10:00:00+00:00`, price });

describe("nearestDayPrices", () => {
  it("returns the closest dated fares, nearest first, lowest price per day", () => {
    const fares = [fare("2027-01-13", 513), fare("2027-01-13", 488), fare("2027-01-10", 600), fare("2027-01-27", 437), fare("2027-03-01", 300)];
    expect(nearestDayPrices(fares, "2027-01-06")).toEqual([
      { date: "2027-01-10", price: 600 },
      { date: "2027-01-13", price: 488 },
      { date: "2027-01-27", price: 437 },
    ]);
  });

  it("skips the date itself, dates too far away and dates in the past", () => {
    const fares = [fare("2027-01-06", 400), fare("2027-01-02", 350), fare("2027-02-20", 300)];
    expect(nearestDayPrices(fares, "2027-01-06", 21, 3, "2027-01-04")).toEqual([]);
  });
});

describe("travelpayoutsSearch fallback", () => {
  afterEach(() => vi.unstubAllGlobals());

  const item = (date: string, price: number) => ({
    origin: "NYC", destination: "TYO", origin_airport: "JFK", destination_airport: "HND", price, airline: "NH", flight_number: 9,
    departure_at: `${date}T11:00:00-05:00`, transfers: 0, duration_to: 840, link: "/search/x",
  });
  const query = { from: "NYC", to: "TYO", date: "2027-01-06", adults: 1, cabin: "economy" as const, directOnly: false };

  it("shows the closest dates when the exact date and the 3 days around it have no fares", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const at = new URL(url).searchParams.get("departure_at");
      const data = at === "2027-01" ? [item("2027-01-13", 513), item("2027-01-14", 488), item("2027-01-27", 437)] : [];
      return new Response(JSON.stringify({ success: true, data }));
    }));
    const { offers, notices } = await travelpayoutsSearch(query, "token");
    expect(offers.map((o) => o.departLocal.slice(0, 10))).toEqual(["2027-01-13", "2027-01-14"]);
    expect(notices.join(" ")).toMatch(/closest we have \(Jan 13, Jan 14\)/);
  });

  it("returns nothing, without a misleading notice, when no fare is within two weeks", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const at = new URL(url).searchParams.get("departure_at");
      return new Response(JSON.stringify({ success: true, data: at === "2027-01" ? [item("2027-01-27", 437)] : [] }));
    }));
    const { offers, notices } = await travelpayoutsSearch(query, "token");
    expect(offers).toEqual([]);
    expect(notices).toEqual([]);
  });
});

describe("approxUsd", () => {
  it("reads the yen sign as yuan in China and yen in Japan", () => {
    expect(approxUsd("¥950", "CN")).toBe("$135");
    expect(approxUsd("¥12,000", "JP")).toBe("$80");
    expect(approxUsd("¥40–50", "CN")).toBe("$6–7");
  });

  it("leaves dollar prices and unknown currencies alone", () => {
    expect(approxUsd("$120", "CN")).toBeUndefined();
    expect(approxUsd("US$120", "CN")).toBeUndefined();
    expect(approxUsd("¥950", "TH")).toBeUndefined();
    expect(approxUsd("HK$900–1,400", "HK")).toBe("$115–180");
  });
});

describe("keepOwnItems", () => {
  const plan = (days: PlanResponse["days"]): PlanResponse => ({ title: "", summary: "", questions: [], routeSuggestion: null, days, beforeYouGo: [] });
  const mine = { time: "Evening", title: "Nevertheless Café", kind: "drink" as const, placeName: "Nevertheless Café", mine: true };

  it("carries the traveller's own items into the same dates of a new plan", () => {
    const prev = plan([{ date: "2026-12-11", city: "BJS", title: "Arrive", items: [mine, { time: "Morning", title: "Old AI item", kind: "see" }] }]);
    const next = plan([
      { date: "2026-12-11", city: "BJS", title: "Arrival", items: [{ time: "16:00", title: "Check in to your hotel", kind: "stay" }] },
      { date: "2026-12-12", city: "BJS", title: "Hutongs", items: [] },
    ]);
    const out = keepOwnItems(prev, next);
    expect(out.days[0].items.map((i) => i.title)).toEqual(["Check in to your hotel", "Nevertheless Café"]);
    expect(out.days[1].items).toEqual([]);
  });

  it("replaces the new plan's copy of the same place rather than listing it twice", () => {
    const prev = plan([{ date: "2026-12-11", city: "BJS", title: "Arrive", items: [mine] }]);
    const next = plan([{ date: "2026-12-11", city: "BJS", title: "Arrival", items: [{ time: "Evening", title: "Drinks at Nevertheless Café", kind: "drink", placeName: "Nevertheless Café" }] }]);
    const out = keepOwnItems(prev, next);
    expect(out.days[0].items).toHaveLength(1);
    expect(out.days[0].items[0].mine).toBe(true);
  });

  it("drops own items whose date is no longer in the trip", () => {
    const prev = plan([{ date: "2026-12-30", city: "BJS", title: "Gone", items: [mine] }]);
    const next = plan([{ date: "2026-12-11", city: "BJS", title: "Arrival", items: [] }]);
    expect(keepOwnItems(prev, next)).toEqual(next);
  });
});
