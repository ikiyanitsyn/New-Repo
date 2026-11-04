import { describe, expect, it } from "vitest";
import { buildPrompt, daySlots } from "../ai/prompt";
import { extractJson, samplePlan, sanitize } from "../ai/plan";
import { officialLinks } from "../ai/official";
import { PlanRequest, PlanResponse } from "../ai/schema";

const req = PlanRequest.parse({
  request: "Food and temples, relaxed pace",
  trip: {
    home: "NYC", departDate: "2027-04-08", adults: 2, cabin: "economy", returnHome: true,
    stops: [{ city: "BJS", nights: 3 }, { city: "HKG", nights: 2 }], modes: ["flight"],
    saved: { BJS: ["Lama Temple"] },
  },
});

describe("AI planner", () => {
  it("makes one slot per day from arrival to departure", () => {
    const s = daySlots(req);
    expect(s.map((d) => `${d.date} ${d.city}`)).toEqual([
      "2027-04-09 BJS", "2027-04-10 BJS", "2027-04-11 BJS", "2027-04-12 HKG", "2027-04-13 HKG", "2027-04-14 HKG",
    ]);
    expect(s[0].note).toMatch(/arrive from New York/);
    expect(s[3].note).toMatch(/by flight/);
    expect(s.at(-1)!.note).toMatch(/fly home/);
  });

  it("puts the request, saved places and day slots in the prompt", () => {
    const { system, user } = buildPrompt(req, { BJS: [{ id: "1", category: "see", name: "Forbidden City" }] });
    expect(system).toMatch(/ONE JSON object/);
    expect(user).toMatch(/Food and temples/);
    expect(user).toMatch(/Lama Temple/);
    expect(user).toMatch(/Forbidden City \[Palaces & landmarks\]/);
    expect(user).toMatch(/Day 6: 2027-04-14 in HKG/);
  });

  it("extracts JSON even inside code fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("drops days on wrong dates and unknown cities", () => {
    const resp = PlanResponse.parse({
      title: "t", summary: "s",
      days: [
        { date: "2027-04-09", city: "BJS", title: "ok", items: [] },
        { date: "2030-01-01", city: "BJS", title: "wrong date", items: [] },
        { date: "2027-04-10", city: "ZZZ", title: "unknown city", items: [] },
      ],
      routeSuggestion: { reason: "r", stops: [{ city: "ZZZ", nights: 2 }, { city: "SHA", nights: 2 }] },
    });
    const clean = sanitize(resp, req);
    expect(clean.days.map((d) => d.title)).toEqual(["ok"]);
    expect(clean.routeSuggestion?.stops.map((s) => s.city)).toEqual(["SHA"]);
  });

  it("builds a valid sample plan without a key", () => {
    const plan = samplePlan(req, {});
    expect(PlanResponse.safeParse(plan).success).toBe(true);
    expect(plan.days).toHaveLength(6);
  });

  it("links official entry sources per country", () => {
    const links = officialLinks(["BJS", "SHA", "HKG"]);
    expect(links.map((l) => l.country)).toEqual(["China", "Hong Kong SAR"]);
    expect(links[0].links[0].url).toMatch(/travel\.state\.gov.*China\.html/);
  });
});
