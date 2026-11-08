import { describe, expect, it } from "vitest";
import { tripBudget } from "../budget";
import { sampleTrip } from "../trip";
import { tripReducer } from "../tripReducer";

describe("trip budget", () => {
  it("counts ground estimates and flags missing flights and hotels", () => {
    const b = tripBudget(sampleTrip());
    expect(b.flights).toBe(0);
    expect(b.ground).toBeGreaterThan(0);
    expect(b.missing.flights).toBe(3); // outbound, Chengdu→Shanghai, return
    expect(b.missing.hotels).toBe(5);
  });

  it("adds chosen flights, hotels × nights, and activities", () => {
    let t = sampleTrip();
    t = tripReducer(t, { type: "pick", legId: "outbound", pick: { offerId: "x", date: t.departDate, priceTotal: 800, airlines: ["CA"], durationMin: 800, stops: 0, departLocal: "", source: "sample" } });
    t = tripReducer(t, { type: "hotel", city: "BJS", hotel: { name: "Courtyard", nightly: 150, source: "manual" } });
    t = tripReducer(t, { type: "hotel", city: "SIA", hotel: { name: "No price yet", source: "guide" } });
    t = tripReducer(t, { type: "addCost", cost: { label: "Great Wall tour", amount: 120 } });
    const b = tripBudget(t);
    expect(b.flights).toBe(800);
    expect(b.hotels).toBe(600); // 4 nights in Beijing
    expect(b.activities).toBe(120);
    expect(b.missing.hotels).toBe(3);
    expect(b.missing.hotelPrices).toBe(1);
    expect(b.total).toBe(b.flights + b.ground + b.hotels + b.activities);
  });

  it("one-way trips have no return flight", () => {
    const t = tripReducer(sampleTrip(), { type: "tripType", value: "oneway" });
    expect(t.returnHome).toBe(false);
    expect(tripBudget(t).missing.flights).toBe(2);
  });

  it("keeps notes, confirmations and travellers tidy", () => {
    let t = tripReducer(sampleTrip(), { type: "travellers", names: [" Jules ", "", "Iggy"] });
    t = tripReducer(t, { type: "confirmation", key: "outbound", value: " ABC123 " });
    t = tripReducer(t, { type: "dayNote", date: "2027-04-09", text: "Rest" });
    expect(t.travellers).toEqual(["Jules", "Iggy"]);
    expect(t.confirmations).toEqual({ outbound: "ABC123" });
    t = tripReducer(t, { type: "confirmation", key: "outbound", value: "" });
    expect(t.confirmations).toEqual({});
    expect(t.dayNotes?.["2027-04-09"]).toBe("Rest");
  });
});
