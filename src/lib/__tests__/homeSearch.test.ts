import { describe, expect, it } from "vitest";
import {
  groundNights,
  initialSearch,
  searchProblem,
  searchTripActions,
  switchTripType,
  tripSummaryLine,
  type TripSearch,
} from "../newTrip";
import { sampleTrip, stopsWithDates, tripEndDate, tripLegs, type Trip } from "../trip";
import { tripReducer } from "../tripReducer";

const used: Trip = { ...sampleTrip(), picks: { outbound: {} as never }, saved: { BJS: [] } };
const build = (s: TripSearch) => searchTripActions(s).reduce(tripReducer, used);

const base: TripSearch = {
  tripType: "round",
  home: "NYC",
  to: "BJS",
  cities: [],
  stopover: { nights: 2 },
  departDate: "2027-04-08",
  returnDate: "2027-04-18",
  nights: 7,
  adults: 2,
  cabin: "business",
};

describe("home search → trip, for each trip type", () => {
  it("one way: no return flight, stay length from the stepper", () => {
    const t = build({ ...base, tripType: "oneway", returnDate: undefined, nights: 6 });
    expect(t.tripType).toBe("oneway");
    expect(t.returnHome).toBe(false);
    expect(t.stops.map((s) => [s.city, s.nights])).toEqual([["BJS", 6]]);
    expect(tripLegs(t).map((l) => l.kind)).toEqual(["outbound"]);
    expect(t.cabin).toBe("business");
    expect(t.adults).toBe(2);
  });

  it("round trip: returns from the arrival city on the chosen return date", () => {
    const t = build(base);
    expect(t.tripType).toBe("round");
    expect(t.returnHome).toBe(true);
    // 10 days away; the flight to Asia lands the next day, so 9 nights in Beijing.
    expect(t.stops.map((s) => [s.city, s.nights])).toEqual([["BJS", 9]]);
    expect(tripEndDate(t)).toBe("2027-04-18");
    const legs = tripLegs(t);
    expect(legs.map((l) => l.kind)).toEqual(["outbound", "return"]);
    expect(legs[1].from.code).toBe("BJS");
    expect(t.picks).toEqual({});
    expect(t.saved).toBeUndefined();
    expect(t.title).toBe("Beijing trip");
  });

  it("multi-city: keeps the order and flies home from the last city", () => {
    const t = build({
      ...base,
      tripType: "multi",
      to: undefined,
      cities: [
        { key: "a", city: "SHA", nights: 3 },
        { key: "b", city: "UKY", nights: 4 },
        { key: "c", city: "HKG", nights: 2 },
      ],
    });
    expect(t.stops.map((s) => s.city)).toEqual(["SHA", "UKY", "HKG"]);
    expect(t.stops.map((s) => s.nights)).toEqual([3, 4, 2]);
    const legs = tripLegs(t);
    expect(legs[legs.length - 1]).toMatchObject({ kind: "return" });
    expect(legs[legs.length - 1].from.code).toBe("HKG");
    expect(t.returnHome).toBe(true);
    expect(t.title).toBe("Shanghai to Hong Kong");
  });

  it("stopover: marks the hub stop and gives the rest of the range to the destination", () => {
    const t = build({ ...base, tripType: "stopover", to: "PAR", stopover: { city: "REK", nights: 2 }, returnDate: "2027-04-18" });
    expect(t.tripType).toBe("stopover");
    expect(t.stops.map((s) => [s.city, s.nights, s.stopover ?? false])).toEqual([
      ["REK", 2, true],
      ["PAR", 7, false],
    ]);
    expect(tripEndDate(t)).toBe("2027-04-18");
    expect(stopsWithDates(t)[0].arrive).toBe("2027-04-09");
    expect(t.title).toBe("Paris trip");
  });

  it("explains what is missing, in the order to fix it", () => {
    expect(searchProblem({ ...base, to: undefined })?.field).toBe("to");
    expect(searchProblem({ ...base, returnDate: undefined })?.field).toBe("dates");
    // Leaving Apr 8, back Apr 9: the overnight flight leaves no nights in Beijing.
    expect(searchProblem({ ...base, returnDate: "2027-04-09" })?.field).toBe("dates");
    expect(searchProblem({ ...base, tripType: "multi", cities: [] })?.field).toBe("cities");
    expect(searchProblem({ ...base, tripType: "stopover", stopover: { nights: 2 } })?.field).toBe("stopover");
    expect(searchProblem({ ...base, tripType: "stopover", stopover: { city: "BJS", nights: 2 } })?.field).toBe("stopover");
    expect(searchProblem({ ...base, tripType: "stopover", to: "PAR", stopover: { city: "REK", nights: 2 }, returnDate: "2027-04-11" })?.field).toBe("dates");
    expect(searchProblem({ ...base, tripType: "oneway", returnDate: undefined })).toBeNull();
    expect(searchProblem(base)).toBeNull();
  });

  it("counts ground nights after the overnight flight, and none for domestic", () => {
    expect(groundNights(base)).toBe(9);
    expect(groundNights({ ...base, home: "NYC", to: "PAR", returnDate: "2027-04-15" })).toBe(6);
  });

  it("switching type carries the route over", () => {
    const stop: TripSearch = { ...base, tripType: "stopover", to: "PAR", stopover: { city: "REK", nights: 2 } };
    const multi = switchTripType(stop, "multi");
    expect(multi.cities.map((c) => [c.city, c.nights])).toEqual([["REK", 2], ["PAR", 7]]);
    const back = switchTripType({ ...multi, to: undefined }, "round");
    expect(back.to).toBe("PAR");
  });

  it("starts from the trip's home, travellers and cabin", () => {
    const s = initialSearch({ ...sampleTrip(), home: "SFO", adults: 3, cabin: "premium" }, new Date("2026-11-08T12:00:00Z"));
    expect(s).toMatchObject({ home: "SFO", adults: 3, cabin: "premium", tripType: "round", departDate: "2027-01-03", returnDate: "2027-01-11" });
  });

  it("summarises the current trip for the Continue card", () => {
    expect(tripSummaryLine(sampleTrip())).toEqual({ title: "China in spring", meta: "Apr 8–24 · 5 cities" });
  });
});
