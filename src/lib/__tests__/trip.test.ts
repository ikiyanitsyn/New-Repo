import { describe, expect, it } from "vitest";
import { sampleTrip, stopsWithDates, tripEndDate, tripLegs, tripNights, isTrip } from "../trip";
import { tripReducer } from "../tripReducer";

describe("trip dates and legs", () => {
  const t = sampleTrip();

  it("arrives in Asia the day after leaving the US", () => {
    const s = stopsWithDates(t);
    expect(s[0].arrive).toBe("2027-04-09");
    expect(s[0].depart).toBe("2027-04-13");
  });

  it("builds outbound, between-stop and return legs", () => {
    const legs = tripLegs(t);
    expect(legs.map((l) => l.kind)).toEqual(["outbound", "between", "between", "between", "between", "return"]);
    expect(legs[1].mode).toBe("train"); // Beijing → Xi'an has fast rail
    expect(legs[3].mode).toBe("flight"); // Chengdu → Shanghai set to fly
    expect(legs[legs.length - 1].date).toBe(tripEndDate(t));
  });

  it("supports open-jaw trips with no return flight", () => {
    const legs = tripLegs(tripReducer(t, { type: "returnHome", value: false }));
    expect(legs.at(-1)?.kind).toBe("between");
  });

  it("counts nights and keeps them in range", () => {
    expect(tripNights(t)).toBe(15);
    const t2 = tripReducer(t, { type: "nights", id: "beijing", value: 99 });
    expect(t2.stops[0].nights).toBe(30);
  });

  it("reorders and removes stops", () => {
    const moved = tripReducer(t, { type: "moveStop", id: "xian", dir: -1 });
    expect(moved.stops[0].id).toBe("xian");
    const removed = tripReducer(t, { type: "removeStop", id: "xian" });
    expect(removed.stops.map((s) => s.id)).not.toContain("xian");
  });

  it("rejects saved trips with unknown cities", () => {
    expect(isTrip(t)).toBe(true);
    expect(isTrip({ ...t, stops: [{ id: "x", city: "ZZZ", nights: 1 }] })).toBe(false);
  });
});
