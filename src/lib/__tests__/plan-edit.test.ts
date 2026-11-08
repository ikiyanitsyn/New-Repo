import { describe, expect, it } from "vitest";
import {
  chronologicalIndex, dayIndexByDate, insertItem, makeOwnItem, moveItem, moveToDay, removeItem, replaceItem, slotToIndex,
  stepItem, timeKey, usedPlaceNames,
} from "../ai/edit";
import { linkDays, linkItem } from "../ai/placeLinks";
import { buildDaysPrompt, candidateList, chunkSlots, daySlots } from "../ai/prompt";
import { PlanItem, PlanRequest, PlanResponse } from "../ai/schema";
import type { Place } from "../places/types";

const item = (title: string, time = "Morning", extra: Partial<PlanItem> = {}): PlanItem => ({ time, title, kind: "see", ...extra });

function plan(): PlanResponse {
  return PlanResponse.parse({
    title: "T",
    days: [
      { date: "2027-04-09", city: "BJS", title: "One", items: [item("a"), item("b", "Afternoon"), item("c", "Evening")] },
      { date: "2027-04-10", city: "BJS", title: "Two", items: [item("d"), item("e", "Evening")] },
      { date: "2027-04-11", city: "BJS", title: "Empty", items: [] },
    ],
  });
}
const titles = (r: PlanResponse, day: number) => r.days[day].items.map((i) => i.title);

describe("moving items", () => {
  it("reorders within a day and never mutates the input", () => {
    const p = plan();
    const next = moveItem(p, { day: 0, index: 0 }, { day: 0, index: 2 });
    expect(titles(next, 0)).toEqual(["b", "c", "a"]);
    expect(titles(p, 0)).toEqual(["a", "b", "c"]);
    expect(next.days[1]).toBe(p.days[1]); // untouched days are shared
  });

  it("moves between days, including into an empty day", () => {
    const p = plan();
    const next = moveItem(p, { day: 0, index: 1 }, { day: 1, index: 1 });
    expect(titles(next, 0)).toEqual(["a", "c"]);
    expect(titles(next, 1)).toEqual(["d", "b", "e"]);
    expect(titles(moveItem(p, { day: 1, index: 0 }, { day: 2, index: 0 }), 2)).toEqual(["d"]);
  });

  it("keeps the very same item object when it moves", () => {
    const p = plan();
    const moved = p.days[0].items[1];
    expect(moveItem(p, { day: 0, index: 1 }, { day: 1, index: 0 }).days[1].items[0]).toBe(moved);
  });

  it("returns the same object for a no-op or a bad reference", () => {
    const p = plan();
    expect(moveItem(p, { day: 0, index: 1 }, { day: 0, index: 1 })).toBe(p);
    expect(moveItem(p, { day: 9, index: 0 }, { day: 0, index: 0 })).toBe(p);
    expect(moveItem(p, { day: 0, index: 9 }, { day: 0, index: 0 })).toBe(p);
    expect(moveItem(p, { day: 0, index: 0 }, { day: 7, index: 0 })).toBe(p);
    expect(stepItem(p, { day: 0, index: 0 }, -1)).toBe(p);
    expect(stepItem(p, { day: 0, index: 2 }, 1)).toBe(p);
  });

  it("steps up and down one place", () => {
    const p = plan();
    expect(titles(stepItem(p, { day: 0, index: 1 }, -1), 0)).toEqual(["b", "a", "c"]);
    expect(titles(stepItem(p, { day: 0, index: 1 }, 1), 0)).toEqual(["a", "c", "b"]);
  });

  it("turns a drop gap into a final position (gaps next to the item itself change nothing)", () => {
    const from = { day: 0, index: 1 };
    expect(slotToIndex(from, 0, 1)).toBe(1);
    expect(slotToIndex(from, 0, 2)).toBe(1);
    expect(slotToIndex(from, 0, 3)).toBe(2);
    expect(slotToIndex(from, 0, 0)).toBe(0);
    expect(slotToIndex(from, 1, 2)).toBe(2);
    const p = plan();
    expect(moveItem(p, from, { day: 0, index: slotToIndex(from, 0, 2) })).toBe(p);
  });

  it("moves to another day at the place its time suggests", () => {
    const p = plan();
    // "b" is an afternoon item: it lands between d (morning) and e (evening).
    expect(titles(moveToDay(p, { day: 0, index: 1 }, 1), 1)).toEqual(["d", "b", "e"]);
    expect(moveToDay(p, { day: 0, index: 1 }, 0)).toBe(p);
  });
});

describe("deleting, adding and replacing", () => {
  it("removes an item and hands it back for undo", () => {
    const p = plan();
    const { response, removed } = removeItem(p, { day: 0, index: 1 });
    expect(removed?.title).toBe("b");
    expect(titles(response, 0)).toEqual(["a", "c"]);
    // Undo: put it back where it was.
    expect(titles(insertItem(response, 0, removed!, 1), 0)).toEqual(["a", "b", "c"]);
    expect(removeItem(p, { day: 5, index: 0 })).toEqual({ response: p, removed: null });
  });

  it("finds a day by date so an undo still lands after other edits", () => {
    const p = plan();
    expect(dayIndexByDate(p, "2027-04-11")).toBe(2);
    expect(dayIndexByDate(p, "2030-01-01")).toBe(-1);
  });

  it("inserts in time order when no index is given", () => {
    expect(timeKey("Morning")).toBeLessThan(timeKey("Afternoon")!);
    expect(timeKey("13:30")).toBe(13 * 60 + 30);
    expect(timeKey("25:00")).toBeNull();
    expect(timeKey("whenever")).toBeNull();
    const p = plan();
    expect(titles(insertItem(p, 0, item("x", "Afternoon")), 0)).toEqual(["a", "b", "x", "c"]); // after b: same time of day
    expect(titles(insertItem(p, 0, item("x", "10:30")), 0)).toEqual(["a", "x", "b", "c"]);
    expect(titles(insertItem(p, 0, item("x", "")), 0)).toEqual(["a", "b", "c", "x"]);
    expect(chronologicalIndex([], "Evening")).toBe(0);
  });

  it("replaces one item in place", () => {
    const p = plan();
    const next = replaceItem(p, { day: 1, index: 0 }, item("z"));
    expect(titles(next, 1)).toEqual(["z", "e"]);
    expect(replaceItem(p, { day: 1, index: 5 }, item("z"))).toBe(p);
  });

  it("makes the traveller's own item: trimmed, flagged, never without a title", () => {
    const own = makeOwnItem({ time: "Evening", title: "  Dumpling   class ", kind: "do", note: "  Bring cash " })!;
    expect(own).toEqual({ time: "Evening", title: "Dumpling class", kind: "do", note: "Bring cash", mine: true });
    expect(makeOwnItem({ time: "09:15", title: "Hotel spa", kind: "free" })).toEqual({ time: "09:15", title: "Hotel spa", kind: "free", mine: true });
    expect(makeOwnItem({ time: "Morning", title: "   ", kind: "do" })).toBeNull();
    expect(makeOwnItem({ time: "bogus", title: "x", kind: "do" })!.time).toBe("");
    expect(makeOwnItem({ time: "Morning", title: "x".repeat(300), kind: "do" })!.title.length).toBeLessThanOrEqual(120);
  });

  it("lists place names already planned", () => {
    const p = plan();
    p.days[0].items[0] = item("a", "Morning", { placeName: "Lama Temple" });
    p.days[1].items[0] = item("d", "Morning", { placeName: "Da Dong" });
    expect(usedPlaceNames(p).sort()).toEqual(["Da Dong", "Lama Temple"]);
  });
});

describe("schema stays backward compatible", () => {
  it("reads old plans without `mine`, and keeps `mine` when present", () => {
    const old = PlanItem.parse({ time: "Morning", title: "Walk", kind: "see" });
    expect("mine" in old && old.mine !== undefined).toBe(false);
    expect(PlanItem.parse({ time: "Morning", title: "Mine", kind: "do", mine: true }).mine).toBe(true);
    expect(PlanItem.parse({ time: "Morning", title: "Odd", kind: "do", mine: "yes" }).mine).toBeUndefined();
  });

  it("round-trips an edited plan through the schema unchanged", () => {
    const edited = insertItem(plan(), 0, makeOwnItem({ time: "Evening", title: "Mine", kind: "eat", note: "n" })!);
    expect(PlanResponse.parse(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
  });
});

const guide: Place[] = [
  { id: "m1", category: "eat", name: "Da Dong", alt: "大董" },
  { id: "m2", category: "eat", name: "Noodle Loft", tier: "Budget" },
  { id: "s1", category: "see", name: "Lama Temple" },
  { id: "s2", category: "see", name: "Temple of Heaven" },
];

describe("placeName linking", () => {
  it("rewrites a loose name to the listing's exact name", () => {
    expect(linkItem(item("Dinner", "Evening", { placeName: "da dong" }), guide).placeName).toBe("Da Dong");
    expect(linkItem(item("Dinner", "Evening", { placeName: "大董" }), guide).placeName).toBe("Da Dong");
    expect(linkItem(item("Visit", "Morning", { placeName: "The Lama Temple" }), guide).placeName).toBe("Lama Temple");
  });

  it("leaves exact names and name-less items untouched", () => {
    const exact = item("Dinner", "Evening", { placeName: "Da Dong" });
    expect(linkItem(exact, guide)).toBe(exact);
    const none = item("Free time");
    expect(linkItem(none, guide)).toBe(none);
  });

  it("drops a name that matches no listing (the title stays)", () => {
    const out = linkItem(item("A made-up place", "Evening", { placeName: "Imaginary Bistro" }), guide);
    expect(out.placeName).toBeUndefined();
    expect(out.title).toBe("A made-up place");
  });

  it("links a whole plan by city, skips the traveller's own items and cities without a guide", () => {
    const p = plan();
    p.days[0].items[0] = item("Dinner", "Evening", { placeName: "da dong", kind: "eat" });
    p.days[0].items[1] = item("Mine", "Evening", { placeName: "Whatever", mine: true });
    const [d0, d1] = linkDays(p.days, { BJS: guide });
    expect(d0.items[0].placeName).toBe("Da Dong");
    expect(d0.items[1].placeName).toBe("Whatever");
    const unknown = linkDays([{ ...p.days[0], city: "HKG" }], { BJS: guide });
    expect(unknown[0].items[0].placeName).toBe("da dong");
    expect(d1.items).toHaveLength(2);
  });
});

describe("prompt asks for named, rated places", () => {
  const req = PlanRequest.parse({
    request: "Food",
    trip: { home: "NYC", departDate: "2027-04-08", adults: 2, cabin: "economy", returnHome: true, stops: [{ city: "BJS", nights: 3 }], modes: [], saved: {} },
  });
  const [chunk] = chunkSlots(daySlots(req));

  it("shows ratings next to candidates and lifts well-rated places", () => {
    const list = candidateList(guide, 0, 1, { m1: { rating: 4.6, count: 2310 }, m2: { rating: 4.8, count: 900 } });
    expect(list).toMatch(/Da Dong \[[^\]]*★4\.6 \(2,310\)\]/);
    expect(list.indexOf("Noodle Loft")).toBeLessThan(list.indexOf("Da Dong")); // 4.8 beats 4.6
    expect(candidateList(guide)).not.toMatch(/★/);
  });

  it("ignores ratings with too few reviews when ranking, but still shows them", () => {
    const list = candidateList(guide, 0, 1, { m1: { rating: 5, count: 2 }, m2: { rating: 4.4, count: 500 } });
    expect(list.indexOf("Noodle Loft")).toBeLessThan(list.indexOf("Da Dong"));
    expect(list).toMatch(/★5\.0 \(2\)/);
  });

  it("tells the model to use exact candidate names, and puts ratings in the user message", () => {
    const { system, user } = buildDaysPrompt(req, chunk, { BJS: guide }, { m1: { rating: 4.6, count: 2310 } });
    expect(system).toMatch(/Every meal/);
    expect(system).toMatch(/exact name, copied character for character, in "placeName"/);
    expect(system).toMatch(/higher-rated/);
    expect(user).toMatch(/★ = Google rating/);
    expect(user).toMatch(/Da Dong \[[^\]]*★4\.6 \(2,310\)\]/);
    expect(user).toMatch(/Lama Temple/);
  });
});

describe("writePlan links and rates places", () => {
  it("links each placeName to a listing and shows remembered ratings to the model", async () => {
    const { writePlan } = await import("../ai/plan");
    const seen: string[] = [];
    const provider = {
      name: "gemini" as const,
      primaryModel: "m",
      generateJson: async (_s: string, user: string) => {
        seen.push(user);
        if (!/Day \d+:/.test(user)) return { text: JSON.stringify({ title: "Beijing", summary: "S", beforeYouGo: [{ topic: "Visa", summary: "x" }] }), model: "m", backup: false };
        const days = [...user.matchAll(/Day \d+: (\d{4}-\d{2}-\d{2}) in ([A-Z]{3})/g)].map(([, date, city]) => ({
          date, city, title: "Day", items: [
            { time: "Evening", title: "Dinner at Da Dong", kind: "eat", placeName: "da dong" },
            { time: "Morning", title: "A made-up spot", kind: "see", placeName: "Imaginary Pagoda" },
          ],
        }));
        return { text: JSON.stringify({ days }), model: "m", backup: false };
      },
    };
    const req = PlanRequest.parse({
      trip: { home: "NYC", departDate: "2027-04-08", adults: 2, cabin: "economy", returnHome: false, stops: [{ city: "BJS", nights: 1 }], modes: [], saved: {} },
    });
    const res = await writePlan(req, provider, { BJS: guide }, { ratings: { m1: { rating: 4.6, count: 2310 } } });
    const items = res.response.days.flatMap((d) => d.items);
    expect(items.find((i) => i.kind === "eat")?.placeName).toBe("Da Dong");
    expect(items.find((i) => i.kind === "see")?.placeName).toBeUndefined();
    expect(seen.some((u) => /Da Dong \[[^\]]*★4\.6 \(2,310\)\]/.test(u))).toBe(true);
  });
});
