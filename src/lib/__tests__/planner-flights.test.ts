import { describe, expect, it } from "vitest";
import { airlineAlliance, offerAlliance } from "../flights/alliances";
import { bagsKnown, fareTypeOf, parseBags } from "../flights/bags";
import { applyLayoverFilter, connectionAirports, NO_LAYOVER_FILTER, serpLayoverParams } from "../flights/layover";
import { legNeedsFlight, nextLegNeedingFlight } from "../flights/nextLeg";
import { cheapestDayIndex, monthsAround, pickDayPrices } from "../flights/priceStrip";
import type { FlightOffer } from "../flights/types";
import type { Budget } from "../budget";
import { budgetLines, fmtAmount, isBudgetComplete, perPersonText, stillToChoose } from "../../components/planner/budgetFormat";
import { effectiveTripType, summaryParts } from "../../components/planner/summary";
import { sampleTrip, type FlightPick } from "../trip";

const pick = (date: string): FlightPick => ({ offerId: "x", date, priceTotal: 800, airlines: ["A"], durationMin: 600, stops: 0, departLocal: `${date}T10:00`, source: "sample" });

describe("next leg after choosing a fare", () => {
  const legs = [
    { id: "outbound", mode: "flight", date: "2027-04-08" },
    { id: "a>b", mode: "train", date: "2027-04-12" },
    { id: "b>c", mode: "flight", date: "2027-04-14" },
    { id: "c>d", mode: "flight", date: "2027-04-17" },
    { id: "return", mode: "flight", date: "2027-04-20" },
  ];

  it("goes outbound -> between-city flights -> return, skipping ground legs", () => {
    expect(nextLegNeedingFlight(legs, {}, "outbound")).toBe("b>c");
    expect(nextLegNeedingFlight(legs, { "b>c": pick("2027-04-14") }, "b>c")).toBe("c>d");
    expect(nextLegNeedingFlight(legs, { "c>d": pick("2027-04-17") }, "c>d")).toBe("return");
  });

  it("treats the leg just chosen as done even before its pick is stored", () => {
    expect(nextLegNeedingFlight(legs, {}, "b>c")).toBe("c>d");
  });

  it("skips legs that already have a current pick but not ones with a stale date", () => {
    const picks = { "b>c": pick("2027-04-14"), "c>d": pick("2027-04-01") };
    expect(nextLegNeedingFlight(legs, picks, "outbound")).toBe("c>d");
    expect(legNeedsFlight(legs[3], picks)).toBe(true);
    expect(legNeedsFlight(legs[2], picks)).toBe(false);
    expect(legNeedsFlight(legs[1], picks)).toBe(false);
  });

  it("wraps to an earlier open leg, and returns null when every flight is chosen", () => {
    const picks = { "b>c": pick("2027-04-14"), "c>d": pick("2027-04-17"), return: pick("2027-04-20") };
    expect(nextLegNeedingFlight(legs, picks, "return")).toBe("outbound");
    expect(nextLegNeedingFlight(legs, { ...picks, outbound: pick("2027-04-08") }, "return")).toBeNull();
  });
});

describe("price strip", () => {
  const fares = [
    { departure_at: "2027-04-05T10:00:00+08:00", price: 900 },
    { departure_at: "2027-04-06T10:00:00+08:00", price: 850 },
    { departure_at: "2027-04-06T22:00:00+08:00", price: 780 },
    { departure_at: "2027-04-08T07:00:00+08:00", price: 809 },
    { departure_at: "2027-04-09T07:00:00+08:00", price: 0 },
    { departure_at: "2027-04-10T07:00:00+08:00", price: 700 },
    { departure_at: "2027-04-20T07:00:00+08:00", price: 500 },
  ];

  it("lists the 7 days around the date with the lowest price on each", () => {
    const days = pickDayPrices(fares, "2027-04-08");
    expect(days.map((d) => d.date)).toEqual(["2027-04-05", "2027-04-06", "2027-04-07", "2027-04-08", "2027-04-09", "2027-04-10", "2027-04-11"]);
    expect(days.map((d) => d.price)).toEqual([900, 780, null, 809, null, 700, null]);
    expect(cheapestDayIndex(days)).toBe(5);
  });

  it("crosses month ends and asks for both months", () => {
    expect(pickDayPrices([], "2027-04-30").map((d) => d.date)[6]).toBe("2027-05-03");
    expect(monthsAround("2027-04-30")).toEqual(["2027-04", "2027-05"]);
    expect(monthsAround("2027-04-15")).toEqual(["2027-04"]);
  });

  it("has no cheapest day when nothing is known", () => {
    expect(cheapestDayIndex(pickDayPrices([], "2027-04-08"))).toBe(-1);
  });
});

describe("alliances", () => {
  it("maps names and codes", () => {
    expect(airlineAlliance("United")).toBe("Star Alliance");
    expect(airlineAlliance("UA")).toBe("Star Alliance");
    expect(airlineAlliance("Cathay Pacific")).toBe("oneworld");
    expect(airlineAlliance("air china")).toBe("Star Alliance");
    expect(airlineAlliance("China Eastern")).toBe("SkyTeam");
    expect(airlineAlliance("Hainan Airlines")).toBeNull();
    expect(airlineAlliance("Spirit")).toBeNull();
  });

  it("labels an itinerary only when all carriers share an alliance", () => {
    expect(offerAlliance(["United", "ANA"])).toBe("Star Alliance");
    expect(offerAlliance(["United", "Delta"])).toBeNull();
    expect(offerAlliance(["Hainan Airlines"])).toBeNull();
    expect(offerAlliance([])).toBeNull();
  });
});

describe("bag parsing from SerpApi-like extensions", () => {
  it("reads not-included and included phrases", () => {
    expect(parseBags(["Carry-on bag not included", "Checked baggage for a fee"])).toEqual({ carryOn: 0, checked: 0 });
    expect(parseBags(["Carry-on bag included", "1st checked bag free"])).toEqual({ carryOn: 1, checked: 1 });
    expect(parseBags(["2 checked bags included"])).toEqual({ checked: 2 });
    expect(parseBags(["Checked baggage for a fee", "Bag and fare conditions depend on the return flight"])).toEqual({ checked: 0 });
  });

  it("leaves bags unknown when nothing is said, and ignores unrelated extensions", () => {
    const info = parseBags(["Average legroom (31 in)", "Wi-Fi for a fee", "In-seat power & USB outlets", "Carbon emissions estimate: 133 kg"]);
    expect(info).toEqual({});
    expect(bagsKnown(info)).toBe(false);
    expect(bagsKnown(undefined)).toBe(false);
    expect(bagsKnown({ carryOn: 0 })).toBe(true);
    expect(parseBags(undefined)).toEqual({});
  });

  it("derives the fare type from the cabin, and basic economy only when stated", () => {
    expect(fareTypeOf("economy", undefined)).toBe("Main cabin");
    expect(fareTypeOf("economy", ["Economy", "Basic Economy"])).toBe("Basic economy");
    expect(fareTypeOf("premium", ["Premium Economy"])).toBe("Premium economy");
    expect(fareTypeOf("business", [])).toBe("Business");
    expect(fareTypeOf("first", [])).toBe("First");
  });
});

describe("layover filters", () => {
  const o = (id: string, stops: number, layovers: [string, number][]): FlightOffer => ({
    id, source: "serpapi", priceTotal: 1000, pricePerPerson: 1000, airlines: ["X"], departLocal: "2027-04-08T10:00",
    durationMin: 900, stops, layovers: layovers.map(([airport, durationMin]) => ({ airport, durationMin })), segments: [],
  });
  const offers = [
    o("direct", 0, []),
    o("one-short", 1, [["ICN", 90]]),
    o("one-long", 1, [["IST", 600]]),
    o("two", 2, [["ICN", 120], ["PEK", 200]]),
    o("tp-unknown", 1, []),
  ];
  const ids = (f: Partial<typeof NO_LAYOVER_FILTER>) => applyLayoverFilter(offers, { ...NO_LAYOVER_FILTER, ...f }).map((x) => x.id);

  it("limits stops", () => {
    expect(ids({})).toHaveLength(5);
    expect(ids({ maxStops: 0 })).toEqual(["direct"]);
    expect(ids({ maxStops: 1 })).toEqual(["direct", "one-short", "one-long", "tp-unknown"]);
  });

  it("limits layover length for every layover, letting nonstops and unknown layovers through", () => {
    expect(ids({ maxHours: 4 })).toEqual(["direct", "one-short", "two", "tp-unknown"]);
    expect(ids({ minHours: 2 })).toEqual(["direct", "one-long", "two", "tp-unknown"]);
    expect(ids({ minHours: 2, maxHours: 3 })).toEqual(["direct", "tp-unknown"]);
  });

  it("keeps only itineraries that connect through preferred airports", () => {
    expect(ids({ airports: ["ICN"] })).toEqual(["direct", "one-short", "tp-unknown"]);
    expect(ids({ airports: ["ICN", "PEK"] })).toEqual(["direct", "one-short", "two", "tp-unknown"]);
  });

  it("lists connection airports by how many fares use them", () => {
    expect(connectionAirports(offers)).toEqual([
      { code: "ICN", count: 2 },
      { code: "IST", count: 1 },
      { code: "PEK", count: 1 },
    ]);
  });

  it("builds SerpApi parameters (stops 1 = nonstop, 2 = one or fewer; layover_duration in minutes)", () => {
    expect(serpLayoverParams(NO_LAYOVER_FILTER)).toEqual({});
    expect(serpLayoverParams({ ...NO_LAYOVER_FILTER, maxStops: 0 })).toEqual({ stops: "1" });
    expect(serpLayoverParams({ ...NO_LAYOVER_FILTER, maxStops: 1, minHours: 1.5, maxHours: 5.5 })).toEqual({ stops: "2", layover_duration: "90,330" });
    expect(serpLayoverParams({ ...NO_LAYOVER_FILTER, maxHours: 4 })).toEqual({ layover_duration: "0,240" });
    expect(serpLayoverParams({ ...NO_LAYOVER_FILTER, airports: ["ICN"] })).toEqual({});
  });
});

describe("budget footer helpers", () => {
  const budget = (over: Partial<Budget> = {}): Budget => ({
    flights: 2400, ground: 310, hotels: 1800, activities: 0, total: 4510, perPerson: 2255,
    missing: { flights: 0, hotels: 0, hotelPrices: 0 }, ...over,
  });

  it("writes the gentle still-to-choose line", () => {
    expect(stillToChoose({ flights: 2, hotels: 3, hotelPrices: 0 })).toBe("Still to choose: 2 flights, 3 hotels");
    expect(stillToChoose({ flights: 1, hotels: 1, hotelPrices: 0 })).toBe("Still to choose: 1 flight, 1 hotel");
    expect(stillToChoose({ flights: 0, hotels: 0, hotelPrices: 2 })).toBe("Still to choose: 2 hotel prices");
    expect(stillToChoose({ flights: 0, hotels: 0, hotelPrices: 0 })).toBeNull();
    expect(isBudgetComplete(budget())).toBe(true);
    expect(isBudgetComplete(budget({ missing: { flights: 1, hotels: 0, hotelPrices: 0 } }))).toBe(false);
  });

  it("formats amounts, with a dash for nothing counted yet and ~ for estimates", () => {
    expect(fmtAmount(0)).toBe("—");
    expect(fmtAmount(2400)).toBe("$2,400");
    expect(fmtAmount(310, true)).toBe("~$310");
    expect(fmtAmount(0, true)).toBe("—");
  });

  it("lists the four breakdown lines in order", () => {
    expect(budgetLines(budget()).map((l) => [l.label, l.amount])).toEqual([
      ["Flights", "$2,400"],
      ["Ground transport", "~$310"],
      ["Hotels", "$1,800"],
      ["Activities", "—"],
    ]);
  });

  it("shows per person for groups", () => {
    expect(perPersonText(budget(), 2)).toBe("$2,255 per person · 2 travellers");
    expect(perPersonText(budget(), 1)).toBe("1 traveller");
  });
});

describe("trip summary line", () => {
  it("reads From · dates · travellers · cabin · trip type", () => {
    const trip = sampleTrip();
    const parts = summaryParts(trip);
    expect(parts[0]).toBe("From New York");
    expect(parts[1]).toMatch(/^Apr 8 – Apr \d+, 2027$/);
    expect(parts.slice(2)).toEqual(["1 traveller", "Economy", "Multi-city"]);
    expect(summaryParts({ ...trip, adults: 2, cabin: "premium", tripType: "stopover" }).slice(2)).toEqual(["2 travellers", "Premium economy", "Stopover"]);
  });

  it("derives a trip type for older trips", () => {
    const trip = sampleTrip();
    expect(effectiveTripType({ ...trip, returnHome: false })).toBe("oneway");
    expect(effectiveTripType({ ...trip, stops: trip.stops.slice(0, 1) })).toBe("round");
  });
});
