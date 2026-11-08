import { describe, expect, it } from "vitest";
import { activityRows, buildItinerary, csvCell, glanceRows, itineraryCsv, stayRows, stopSignature, transportLine } from "../itineraryDoc";
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
  it("writes the agenda: a header, one line per day and a transport total", () => {
    const doc = buildItinerary(richTrip())!;
    const lines = itineraryCsv(doc).trim().split("\r\n");
    const head = lines.indexOf("AGENDA");
    expect(head).toBeGreaterThan(-1);
    expect(lines[head + 1]).toBe("Date,Day,Weekday,City,Lodging,Transport,Plan highlights,Cost (USD),Notes");
    expect(lines[head + 2]).toBe('2027-04-08,1,THU,New York → Beijing,—,"Flight NYC → BJS · Air China · dep 13:05 · 13h 55m · nonstop · $1,840",—,1840,');
    expect(lines[head + 2 + 16]).toContain("2027-04-24");
    expect(lines[head + 2 + 17]).toBe(",,,,,,Transport total,2338");
  });

  it("adds the Lodging and Activity sheets as sections, with names, notes and confirmations", () => {
    const doc = buildItinerary(withExtras())!;
    const lines = itineraryCsv(doc).trim().split("\r\n");
    expect(lines.slice(0, 3)).toEqual(["Travelers,Ava; Ben", "Dates,2027-04-08 to 2027-04-24", expect.stringMatching(/^Destination,/)]);
    const stays = lines.indexOf("LODGING CONFIRMATIONS");
    expect(lines[stays + 1]).toBe("City,Hotel,Check-in,Check-out,Nights,Rate per night (USD),Total (USD),Confirm");
    expect(lines[stays + 2]).toBe("Beijing,Hutong Courtyard,2027-04-09,2027-04-13,4,180,720,HTL-123");
    expect(lines[stays + 3]).toBe("Xi'an,Not chosen yet,2027-04-13,2027-04-15,2,,,");
    expect(lines).toContain(",,,,,Stays total,720");
    const acts = lines.indexOf("ACTIVITY CONFIRMATIONS");
    expect(lines[acts + 1]).toBe("Date,City,Activity,Cost (USD),Confirm");
    expect(lines[acts + 2]).toBe("2027-04-10,Beijing,Great Wall tour,95.5,ACT-9");
    expect(lines[acts + 3]).toBe(",,Rail pass,40.25,");
    expect(lines).toContain(",,Activities total,136");
    expect(lines.some((l) => l.startsWith("2027-04-10,") && l.endsWith(",Bring a jacket"))).toBe(true);
    expect(lines.at(-1)).toContain("Trip total");
  });

  it("quotes commas and quotes, and defuses formulas", () => {
    expect(csvCell('Say "hi", then go')).toBe('"Say ""hi"", then go"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("plain")).toBe("plain");
  });
});

function withExtras(): Trip {
  const t = richTrip();
  t.travellers = ["Ava", "Ben"];
  t.hotels = { BJS: { name: "Hutong Courtyard", nightly: 180, source: "manual" } };
  t.confirmations = { outbound: "AB12CD", "hotel:BJS": "HTL-123", a1: "ACT-9" };
  t.costs = [
    { id: "a2", label: "Rail pass", amount: 40.25 },
    { id: "a1", label: "Great Wall tour", amount: 95.5, date: "2027-04-10", city: "BJS" },
  ];
  t.dayNotes = { "2027-04-10": "Bring a jacket" };
  return t;
}

describe("travellers, confirmations, notes, stays and activities", () => {
  const t = withExtras();
  const doc = buildItinerary(t)!;

  it("carries traveller names (trimmed, blanks dropped) and none by default", () => {
    expect(doc.travellerNames).toEqual(["Ava", "Ben"]);
    expect(buildItinerary({ ...t, travellers: [" Cy ", "", "  "] })!.travellerNames).toEqual(["Cy"]);
    expect(buildItinerary(sampleTrip())!.travellerNames).toEqual([]);
  });

  it("attaches confirmation numbers to flight legs, shown in the transport line", () => {
    const out = doc.transport.find((x) => x.legId === "outbound")!;
    expect(out.confirmation).toBe("AB12CD");
    expect(transportLine(out)).toContain("conf AB12CD");
    expect(doc.transport.find((x) => x.legId === "return")!.confirmation).toBeUndefined();
  });

  it("puts the day note on its day only", () => {
    expect(doc.days.find((d) => d.date === "2027-04-10")!.note).toBe("Bring a jacket");
    expect(doc.days.filter((d) => d.note)).toHaveLength(1);
  });

  it("lists one stay per stop with check-in, check-out, nights, rate and confirmation", () => {
    expect(doc.stays).toHaveLength(5);
    expect(doc.stays[0]).toMatchObject({ cityCode: "BJS", hotel: "Hutong Courtyard", checkIn: "2027-04-09", checkOut: "2027-04-13", nights: 4, nightly: 180, total: 720, confirmation: "HTL-123", confirmationKey: "hotel:BJS" });
    expect(doc.stays[1]).toMatchObject({ cityCode: "SIA", hotel: undefined, total: undefined, confirmation: undefined });
    expect(doc.days[1].lodging[0]).toBe("Hutong Courtyard"); // the chosen hotel comes before saved sleeps
    expect(doc.days[1].lodging).toContain("Aman Summer Palace");
    expect(stayRows(doc)[1][1]).toBe("Not chosen yet");
  });

  it("lists activities by date (undated last) with city names and confirmations", () => {
    expect(doc.activities.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(doc.activities[0]).toMatchObject({ label: "Great Wall tour", cityName: "Beijing", amount: 95.5, confirmation: "ACT-9" });
    expect(doc.activities[1]).toMatchObject({ date: undefined, cityName: undefined, confirmation: undefined });
    expect(activityRows(doc)[1]).toEqual(["", "", "Rail pass", "40.25", ""]);
  });

  it("bases the totals on tripBudget()", () => {
    expect(doc.budget.hotels).toBe(720);
    expect(doc.budget.activities).toBe(136); // 135.75 rounded
    expect(doc.budget.total).toBe(doc.budget.flights + doc.budget.ground + 720 + 136);
    expect(doc.budget.missing.hotels).toBe(4);
  });
});
