import { afterEach, describe, expect, it, vi } from "vitest";
import { priceCalendar } from "../flights/calendar";
import { serpapiSearch } from "../flights/serpapi";

const q = { from: "NYC", to: "BJS", date: "2027-04-08", adults: 2, cabin: "economy" as const };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("price calendar", () => {
  it("uses the sample generator without a token", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "");
    const r = await priceCalendar(q);
    expect(r.source).toBe("sample");
    expect(r.days).toHaveLength(7);
    expect(r.days[3].date).toBe("2027-04-08");
    expect(r.days.every((d) => d.price !== null && d.price > 0)).toBe(true);
  });

  it("picks the lowest per-day fare from Travelpayouts month data (mocked) and totals for the party", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token");
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("departure_at=2027-04");
      expect(url).toContain("limit=1000");
      return Response.json({
        success: true,
        data: [
          { departure_at: "2027-04-08T08:00:00+08:00", price: 900 },
          { departure_at: "2027-04-08T20:00:00+08:00", price: 810 },
          { departure_at: "2027-04-10T08:00:00+08:00", price: 700 },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await priceCalendar({ ...q, from: "SFO", to: "SHA" });
    expect(r.source).toBe("travelpayouts");
    expect(r.days.map((d) => d.price)).toEqual([null, null, null, 1620, null, 1400, null]);
    // The month is cached, so a second call for the same route makes no new request.
    await priceCalendar({ ...q, from: "SFO", to: "SHA" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to sample prices when the provider fails", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const r = await priceCalendar({ ...q, from: "LAX", to: "CAN" });
    expect(r.source).toBe("sample");
    expect(r.notices[0]).toMatch(/sample prices/i);
  });
});

describe("SerpApi request and bag mapping (mocked)", () => {
  it("sends stops and layover_duration, and maps bag extensions", async () => {
    let seen = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen = url;
        return Response.json({
          best_flights: [
            {
              flights: [
                { departure_airport: { id: "JFK", time: "2027-04-08 10:00" }, arrival_airport: { id: "PEK", time: "2027-04-09 12:00" }, duration: 840, airline: "Air China", flight_number: "CA 982", travel_class: "Economy" },
              ],
              total_duration: 840,
              price: 1618,
              extensions: ["Carry-on bag included", "Checked baggage for a fee"],
            },
            {
              flights: [
                { departure_airport: { id: "JFK", time: "2027-04-08 10:00" }, arrival_airport: { id: "PEK", time: "2027-04-09 12:00" }, duration: 840, airline: "United", travel_class: "Economy" },
              ],
              total_duration: 840,
              price: 1500,
            },
          ],
        });
      }),
    );
    const r = await serpapiSearch({ ...q, directOnly: false, filter: { maxStops: 1, minHours: 1, maxHours: 4, airports: [] } }, "key");
    const params = new URL(seen).searchParams;
    expect(params.get("stops")).toBe("2");
    expect(params.get("layover_duration")).toBe("60,240");
    expect(r.offers[0].bags).toEqual({ carryOn: 1, checked: 0 });
    expect(r.offers[0].fareText).toContain("Economy");
    expect(r.offers[1].bags).toEqual({});
  });
});
