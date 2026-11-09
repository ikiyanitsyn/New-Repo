import { describe, expect, it } from "vitest";
import { addPlaceToPlan, blankPlan } from "../planAdd";
import { sampleTrip } from "../trip";

const place = { id: "x", category: "see" as const, name: "Temple of Heaven", description: "A Ming-era temple complex. Go early." };

describe("adding guide places to the itinerary", () => {
  it("starts a blank day-by-day plan when there is none", () => {
    const plan = blankPlan(sampleTrip());
    expect(plan.source).toBe("manual");
    expect(plan.response.days[0].date).toBe("2027-04-09");
    expect(plan.response.days.every((d) => d.items.length === 0)).toBe(true);
  });

  it("adds the place to the chosen day, in time order", () => {
    const trip = sampleTrip();
    const plan = addPlaceToPlan(trip, place, "2027-04-10", "Morning")!;
    const day = plan.response.days.find((d) => d.date === "2027-04-10")!;
    expect(day.items[0]).toMatchObject({ title: "Temple of Heaven", kind: "see", placeName: "Temple of Heaven", mine: true, note: "A Ming-era temple complex." });
    const again = addPlaceToPlan({ ...trip, plan }, { ...place, id: "y", name: "Peking duck dinner", category: "eat" }, "2027-04-10", "Evening")!;
    expect(again.response.days.find((d) => d.date === "2027-04-10")!.items.map((i) => i.time)).toEqual(["Morning", "Evening"]);
  });

  it("doesn't add the same place twice to a day, and rejects dates outside the trip", () => {
    const trip = sampleTrip();
    const plan = addPlaceToPlan(trip, place, "2027-04-10", "Morning")!;
    const twice = addPlaceToPlan({ ...trip, plan }, place, "2027-04-10", "Afternoon")!;
    expect(twice.response.days.find((d) => d.date === "2027-04-10")!.items).toHaveLength(1);
    expect(addPlaceToPlan(trip, place, "2030-01-01", "Morning")).toBeNull();
  });
});
