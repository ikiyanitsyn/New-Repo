import { describe, expect, it } from "vitest";
import { buildItinerary, csvCell, glanceRows, itineraryCsv, stopSignature, transportLine } from "../itineraryDoc";
import { sampleTrip, type Trip } from "../trip";
import type { SavedPlan } from "../ai/schema";

function richTrip(): Trip {
  const t: Trip = { ...sampleTrip(), adults: 2, title: "Spring in China" };
  t.picks = {
    outbound: { offerId: "o1", date: "2027-04-08", priceTotal: 1840, airlines: ["CA"], durationMin: 835, stops: 0, departLocal: "2027-04-08T13:05", source: "sample" },
    // Chosen for an old date: must be ignored.
    "chengdu>shanghai": { offerId: "o2", date: "2027-04-01", priceTotal: 300, airlines: ["MU"], durationMin: 170, stops: 0, departLocal: "2027-04-01T09:00", source: "sample" },
  };
  t.saved = {
    BJS: [
      { key: "aman summer palace", name: "Aman Summer Palace", category: "sleep" },
      { key: "forbidden city", name: "Forbidden City", category: "see" },
      { key: "da dong", name: "Da Dong", category: "eat" },
    ],
    SHA: [{ key: "the bund", name: "The Bund", category: "see" }],
  };
  const plan: SavedPlan = {
    createdAt: "2027-01-01T00:00:00Z",
    source: "sample",
    request: "",
    preferences: [],
    answers: {},
    forStops: stopSignature(t),
    response: {
      title: "A first look at China",
      summary: "Palaces, pandas and harbours.",
      questions: [],
      routeSuggestion: null,
      days: [
        { date: "2027-04-09", city: "BJS", title: "Arrive in Beijing", items: [
          { time: "Evening", title: "Arrive from New York", kind: "travel" },
          { time: "Evening", title: "Dinner at Da Dong", kind: "eat", placeName: "Da Dong", note: "Book ahead." },
        ] },
        { date: "2027-04-10", city: "BJS", title: "Imperial Beijing", items: [{ time: "Morning", title: "Forbidden City", kind: "see" }] },
        { date: "2027-04-10", city: "SHA", title: "Wrong city", items: [] },
      ],
      beforeYouGo: [{ topic: "Visa & entry", summary: "Check the rules.", details: [], important: true }],
    },
  };
  t.plan = plan;
  return t;
}

describe("itinerary document", () => {
  const doc = buildItinerary(richTrip())!;

  it("has one row per calendar day from leaving home to flying back", () => {
    expect(doc.days).toHaveLength(17); // depart Apr 8, arrive Apr 9, 15 nights, fly home Apr 24
    expect(doc.days[0]).toMatchObject({ date: "2027-04-08", dayNumber: 1, weekday: "THU", kind: "travel", cityName: "New York → Beijing" });
    expect(doc.days[1]).toMatchObject({ date: "2027-04-09", kind: "arrive", cityCode: "BJS" });
    expect(doc.days[5]).toMatchObject({ date: "2027-04-13", kind: "transfer", cityCode: "SIA" });
    expect(doc.days.at(-1)).toMatchObject({ date: "2027-04-24", kind: "depart", cityCode: "HKG", dayNumber: 17 });
    expect(doc.routeLine).toBe("NYC → BJS → SIA → CTU → SHA → HKG → NYC");
    expect(doc.cities.map((c) => c.days.length)).toEqual([5, 2, 3, 3, 4]);
  });

  it("puts lodging from saved stays on the nights in that city", () => {
    expect(doc.days[0].lodging).toEqual([]);
    expect(doc.days[1].lodging).toEqual(["Aman Summer Palace"]);
    expect(doc.days[4].lodging).toEqual(["Aman Summer Palace"]);
    expect(doc.days[5].lodging).toEqual([]);
    expect(doc.cities[0].places.map((g) => g.label)).toEqual(["Stay", "See", "Eat"]);
  });

  it("describes chosen flights and ground estimates for the day", () => {
    const out = doc.days[0].transport[0];
    expect(out).toMatchObject({ kind: "flight", carrier: "Air China", departTime: "13:05", durationMin: 835, costUsd: 1840, costKind: "chosen" });
    expect(transportLine(out)).toBe("Flight NYC → BJS · Air China · dep 13:05 · 13h 55m · nonstop · $1,840");
    const train = doc.days[5].transport[0];
    expect(train).toMatchObject({ kind: "ground", mode: "train", carrier: "G-train high-speed rail", durationMin: 264, costUsd: 144, costKind: "estimate" });
    const stale = doc.transport.find((t) => t.legId === "chengdu>shanghai")!;
    expect(stale).toMatchObject({ costUsd: null, costKind: "none" });
    expect(doc.days[1].costUsd).toBe(0);
    expect(doc.days[5].costUsd).toBe(144);
  });

  it("takes highlights and items from the matching plan day only", () => {
    expect(doc.days[1].title).toBe("Arrive in Beijing");
    expect(doc.days[1].highlights).toEqual(["Dinner at Da Dong"]);
    expect(doc.days[1].items).toHaveLength(2);
    expect(doc.days[2].highlights).toEqual(["Forbidden City"]);
    expect(doc.days[3].title).toBeUndefined();
    expect(doc.plan).toMatchObject({ present: true, outdated: false, title: "A first look at China" });
    expect(doc.beforeYouGo).toHaveLength(1);
    expect(doc.official.map((o) => o.country)).toEqual(["China", "Hong Kong SAR"]);
  });

  it("totals chosen flights and ground estimates, counting flights still to choose", () => {
    // Ground for 2: BJS→SIA 72, SIA→CTU 37, SHA→HKG 140 per person.
    expect(doc.totals.ground).toBe((72 + 37 + 140) * 2);
    expect(doc.totals.flights).toBe(1840);
    expect(doc.totals.unpricedFlights).toBe(2); // CTU→SHA (stale pick) and the flight home
    expect(doc.totals.total).toBe(1840 + 498);
    expect(doc.days.reduce((s, d) => s + d.costUsd, 0)).toBe(doc.totals.total);
  });

  it("flags a plan written for a different route", () => {
    const t = richTrip();
    t.stops = t.stops.map((s) => (s.id === "beijing" ? { ...s, nights: 3 } : s));
    expect(buildItinerary(t)!.plan.outdated).toBe(true);
  });

  it("returns null for an empty trip and works without picks, saves or a plan", () => {
    expect(buildItinerary({ ...sampleTrip(), stops: [] })).toBeNull();
    const plain = buildItinerary(sampleTrip())!;
    expect(plain.plan.present).toBe(false);
    expect(plain.days.every((d) => d.lodging.length === 0 && d.highlights.length === 0)).toBe(true);
    expect(plain.totals.flights).toBe(0);
    expect(plain.totals.unpricedFlights).toBe(3);
    expect(glanceRows(plain)[3][4]).toBe("—");
  });
});

describe("spreadsheet export", () => {
  it("writes a header, one line per day and a total", () => {
    const doc = buildItinerary(richTrip())!;
    const csv = itineraryCsv(doc);
    expect(csv.startsWith("﻿Date,Day,Weekday,City,Lodging,Transport,Plan highlights,Cost (USD)\r\n")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(1 + 17 + 1);
    expect(lines[1]).toBe('2027-04-08,1,THU,New York → Beijing,—,"Flight NYC → BJS · Air China · dep 13:05 · 13h 55m · nonstop · $1,840",—,1840');
    expect(lines.at(-1)).toBe(",,,,,,Transport total,2338");
  });

  it("quotes commas and quotes, and defuses formulas", () => {
    expect(csvCell('Say "hi", then go')).toBe('"Say ""hi"", then go"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("plain")).toBe("plain");
  });
});
