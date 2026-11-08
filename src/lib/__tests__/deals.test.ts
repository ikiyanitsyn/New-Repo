import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { averagePhrase, cheapestMonthLabel, monthLabel, monthStats, pctBelow } from "../deals/maths";
import { exploreParams, parseExplore } from "../deals/serpapi";
import { getDeals, resetDealsCache } from "../deals/service";
import { cityForIata, parseMonthly, parsePopular } from "../deals/travelpayouts";
import grouped from "./fixtures/tp-grouped-prices.json";
import directions from "./fixtures/tp-city-directions.json";
import explore from "./fixtures/serpapi-travel-explore.json";

describe("deal maths", () => {
  it("labels the cheapest month against the average of the months returned", () => {
    const months = parseMonthly(grouped);
    expect(months).toHaveLength(12);
    const stats = monthStats(months)!;
    // Sum 9092 / 12 = 757.67; (757.67 − 612) / 757.67 = 19.2%.
    expect(stats.average).toBe(758);
    expect(stats.cheapest.month).toBe("2027-04");
    expect(stats.pctBelow).toBe(19);
    expect(cheapestMonthLabel(stats)).toBe("From $612 in April, about 19% below the yearly average");
    expect(monthLabel(months.find((m) => m.month === "2027-07")!, stats)).toBe("$940 in July, about 24% above the yearly average");
  });

  it("never claims a yearly average from a few months", () => {
    const stats = monthStats([{ month: "2027-04", price: 500 }, { month: "2027-05", price: 600 }, { month: "2027-06", price: 700 }])!;
    expect(averagePhrase(stats.count)).toBe("the average of the 3 months with prices");
    expect(cheapestMonthLabel(stats)).toBe("From $500 in April, about 17% below the average of the 3 months with prices");
  });

  it("handles flat and thin data honestly", () => {
    expect(monthStats([{ month: "2027-04", price: 500 }])).toBeNull();
    expect(monthStats([])).toBeNull();
    const flat = monthStats([{ month: "2027-04", price: 600 }, { month: "2027-05", price: 610 }])!;
    expect(cheapestMonthLabel(flat)).toBe("From $600 in April, about the same as the average of the 2 months with prices");
    expect(pctBelow(500, 0)).toBe(0);
  });

  it("ignores junk rows and keeps one price per month", () => {
    const m = parseMonthly({ data: { "2027-04": { price: 700 }, "2027-04-15": { price: 650 }, bad: { price: 10 }, "2027-05": { price: -1 } } });
    expect(m).toEqual([expect.objectContaining({ month: "2027-04", price: 650 })]);
  });
});

describe("travelpayouts parsing", () => {
  it("maps popular directions onto catalog cities, skipping US and unknown codes", () => {
    const p = parsePopular(directions, "NYC");
    expect(p.map((d) => [d.to, d.price])).toEqual([["REK", 365], ["LON", 412], ["BJS", 640]]);
    expect(cityForIata("KEF")?.code).toBe("REK");
    expect(cityForIata("PVG")?.code).toBe("SHA");
  });
});

describe("serpapi travel explore", () => {
  it("parses destinations with prices and links catalog cities", () => {
    const d = parseExplore(explore);
    expect(d.map((x) => [x.name, x.to, x.price])).toEqual([["Seoul", "SEL", 702], ["Tokyo", "TYO", 788], ["Ulaanbaatar", undefined, 1104]]);
  });

  it("asks for the right area, month window and trip length", () => {
    const p = exploreParams({ from: "NYC", to: "PAR", month: "2027-01", nights: 9, adults: 2, cabin: "business" }, "k", new Date("2026-11-08T00:00:00Z"));
    expect(p.get("engine")).toBe("google_travel_explore");
    expect(p.get("departure_id")).toBe("JFK,EWR,LGA");
    expect(p.get("arrival_area_id")).toBe("/m/02j9z");
    expect(p.get("month")).toBe("1");
    expect(p.get("travel_duration")).toBe("2");
    expect(p.get("travel_class")).toBe("3");
    // More than six months ahead: let Google choose.
    expect(exploreParams({ from: "NYC", to: "BJS", month: "2027-08", adults: 1, cabin: "economy" }, "k", new Date("2026-11-08T00:00:00Z")).get("month")).toBeNull();
  });
});

describe("deals service (mocked fetch, no keys in the sandbox)", () => {
  const env = { ...process.env };
  beforeEach(() => resetDealsCache());
  afterEach(() => { process.env = { ...env }; });

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("serves labelled samples with no token", async () => {
    delete process.env.TRAVELPAYOUTS_TOKEN;
    delete process.env.SERPAPI_KEY;
    const fetcher = vi.fn();
    const r = await getDeals({ from: "NYC", to: "BJS", adults: 1, cabin: "economy" }, "analytics", fetcher as never);
    expect(r.source).toBe("sample");
    expect(r.months).toHaveLength(12);
    expect(r.popular.length).toBeGreaterThan(0);
    expect(fetcher).not.toHaveBeenCalled();
    const live = await getDeals({ from: "NYC", adults: 1, cabin: "economy" }, "live", fetcher as never);
    expect(live.liveSource).toBe("sample");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls grouped_prices and city-directions with the token header, then caches", async () => {
    process.env.TRAVELPAYOUTS_TOKEN = "tp-test";
    const fetcher = vi.fn(async (url: string) => json(url.includes("city-directions") ? directions : grouped));
    const q = { from: "NYC", to: "BJS", adults: 1, cabin: "economy" as const };
    const r = await getDeals(q, "analytics", fetcher as never);
    expect(r.source).toBe("travelpayouts");
    expect(monthStats(r.months)?.pctBelow).toBe(19);
    expect(r.popular[0].to).toBe("REK");
    const urls = fetcher.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.startsWith("https://api.travelpayouts.com/aviasales/v3/grouped_prices?") && u.includes("group_by=month") && u.includes("origin=NYC") && u.includes("destination=BJS"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://api.travelpayouts.com/v1/city-directions?"))).toBe(true);
    expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ "X-Access-Token": "tp-test" });
    await getDeals(q, "analytics", fetcher as never);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("falls back to prices/monthly when grouped_prices fails", async () => {
    process.env.TRAVELPAYOUTS_TOKEN = "tp-test";
    const fetcher = vi.fn(async (url: string) => (url.includes("grouped_prices") ? json({}, 500) : url.includes("monthly") ? json(grouped) : json(directions)));
    const r = await getDeals({ from: "NYC", to: "BJS", adults: 1, cabin: "economy" }, "analytics", fetcher as never);
    expect(r.months).toHaveLength(12);
    expect(fetcher.mock.calls.some((c) => String(c[0]).includes("/v1/prices/monthly?"))).toBe(true);
  });

  it("counts live searches against the monthly limit and caches them", async () => {
    process.env.SERPAPI_KEY = "serp-test";
    process.env.SERPAPI_DEALS_MONTHLY_LIMIT = "1";
    const fetcher = vi.fn(async () => json(explore));
    const q = { from: "NYC", to: "TYO", month: "2027-01", adults: 1, cabin: "economy" as const };
    const a = await getDeals(q, "live", fetcher as never);
    expect(a.liveSource).toBe("serpapi");
    expect(a.live?.[0].name).toBe("Seoul");
    expect(a.liveQuota).toEqual({ used: 1, limit: 1 });
    await getDeals(q, "live", fetcher as never); // cached: no new search
    expect(fetcher).toHaveBeenCalledTimes(1);
    const b = await getDeals({ ...q, month: "2027-02" }, "live", fetcher as never);
    expect(b.notices[0]).toMatch(/used up/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
