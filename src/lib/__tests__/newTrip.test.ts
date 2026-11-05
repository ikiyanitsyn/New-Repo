import { describe, expect, it } from "vitest";
import { defaultDepartDate, guestsToAdults, newTripActions } from "../newTrip";
import { sampleTrip, stopsWithDates, tripLegs, type Trip } from "../trip";
import { tripReducer } from "../tripReducer";

const build = (input: Parameters<typeof newTripActions>[0]) => {
  // Start from a "used" trip to prove old fares, saved places and plans are cleared.
  const used: Trip = { ...sampleTrip(), picks: { outbound: {} as never }, saved: { BJS: [] } };
  return newTripActions(input).reduce(tripReducer, used);
};

describe("new trip from the opening page", () => {
  it("creates a one-stop trip with the chosen home, date, nights and travellers", () => {
    const t = build({ home: "SFO", destination: "SHA", departDate: "2027-05-01", nights: 6, adults: 2 });
    expect(t.home).toBe("SFO");
    expect(t.departDate).toBe("2027-05-01");
    expect(t.adults).toBe(2);
    expect(t.stops.map((s) => [s.city, s.nights])).toEqual([["SHA", 6]]);
    expect(t.picks).toEqual({});
    expect(t.saved).toBeUndefined();
    expect(t.title).toBe("Shanghai trip");
    expect(tripLegs(t).map((l) => l.kind)).toEqual(["outbound", "return"]);
    expect(stopsWithDates(t)[0].arrive).toBe("2027-05-02");
  });

  it("leaves the route empty for the concierge when no city is chosen", () => {
    const t = build({ home: "NYC", departDate: "2027-05-01", nights: 5, adults: 1 });
    expect(t.stops).toEqual([]);
    expect(t.title).toBe("My trip");
  });

  it("keeps nights and group sizes in range", () => {
    const t = build({ home: "NYC", destination: "BJS", departDate: "2027-05-01", nights: 99, adults: 1 });
    expect(t.stops[0].nights).toBe(30);
    expect(guestsToAdults("solo", 5)).toBe(1);
    expect(guestsToAdults("two", 5)).toBe(2);
    expect(guestsToAdults("group", 1)).toBe(3);
    expect(guestsToAdults("group", 20)).toBe(9);
  });

  it("defaults the departure about eight weeks out", () => {
    expect(defaultDepartDate(new Date("2026-11-05T12:00:00Z"))).toBe("2026-12-31");
  });
});
