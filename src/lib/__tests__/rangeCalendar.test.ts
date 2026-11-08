import { describe, expect, it } from "vitest";
import { dayState, monthGrid, moveFocus, nights, pickDay, rangeProblem, shiftMonths } from "@/components/home/rangeCalendar";

describe("range calendar logic", () => {
  it("counts nights, including across months and years", () => {
    expect(nights("2027-04-08", "2027-04-24")).toBe(16);
    expect(nights("2027-01-30", "2027-02-02")).toBe(3);
    expect(nights("2027-12-28", "2028-01-04")).toBe(7);
    expect(nights("2028-02-28", "2028-03-01")).toBe(2); // leap year
  });

  it("picks a departure, then a return; earlier picks start over", () => {
    let r = pickDay({}, "2027-04-08", "range");
    expect(r).toEqual({ start: "2027-04-08", end: undefined });
    r = pickDay(r, "2027-04-20", "range");
    expect(r).toEqual({ start: "2027-04-08", end: "2027-04-20" });
    // A pick after a full range starts a new one.
    expect(pickDay(r, "2027-05-01", "range")).toEqual({ start: "2027-05-01", end: undefined });
    // A return on or before the departure becomes the new departure.
    expect(pickDay({ start: "2027-04-08" }, "2027-04-05", "range")).toEqual({ start: "2027-04-05", end: undefined });
    expect(pickDay({ start: "2027-04-08" }, "2027-04-08", "range")).toEqual({ start: "2027-04-08", end: undefined });
  });

  it("one way picks a single date with no return", () => {
    expect(pickDay({ start: "2027-04-08", end: "2027-04-20" }, "2027-04-10", "single")).toEqual({ start: "2027-04-10" });
    expect(rangeProblem({ start: "2027-04-10" }, "single", "2026-11-08")).toBeNull();
  });

  it("rejects invalid ranges", () => {
    expect(rangeProblem({}, "range")).toMatch(/departure/);
    expect(rangeProblem({ start: "2027-04-08" }, "range")).toMatch(/return/);
    expect(rangeProblem({ start: "2027-04-08", end: "2027-04-08" }, "range")).toMatch(/after/);
    expect(rangeProblem({ start: "2027-04-08", end: "2027-04-01" }, "range")).toMatch(/after/);
    expect(rangeProblem({ start: "2026-11-01", end: "2026-11-10" }, "range", "2026-11-08")).toMatch(/past/);
    expect(rangeProblem({ start: "2027-01-01", end: "2027-04-01" }, "range")).toMatch(/60 nights/);
    expect(rangeProblem({ start: "2027-04-08", end: "2027-04-24" }, "range", "2026-11-08")).toBeNull();
  });

  it("draws the range, with a hover preview while choosing the return", () => {
    const r = { start: "2027-04-08", end: "2027-04-11" };
    expect(["2027-04-07", "2027-04-08", "2027-04-09", "2027-04-11", "2027-04-12"].map((d) => dayState(d, r, "range"))).toEqual(["none", "start", "inside", "end", "none"]);
    expect(dayState("2027-04-10", { start: "2027-04-08" }, "range", "2027-04-12")).toBe("inside");
    expect(dayState("2027-04-08", { start: "2027-04-08" }, "range")).toBe("single");
    expect(dayState("2027-04-09", { start: "2027-04-08" }, "single", "2027-04-12")).toBe("none");
  });

  it("lays out months Sunday-first with blanks", () => {
    const apr = monthGrid("2027-04"); // April 1 2027 is a Thursday
    expect(apr[0]).toEqual([null, null, null, null, "2027-04-01", "2027-04-02", "2027-04-03"]);
    expect(apr.flat().filter(Boolean)).toHaveLength(30);
    expect(apr.every((w) => w.length === 7)).toBe(true);
  });

  it("moves focus like the WAI-ARIA date picker", () => {
    expect(moveFocus("2027-04-08", "ArrowRight")).toBe("2027-04-09");
    expect(moveFocus("2027-04-08", "ArrowUp")).toBe("2027-04-01");
    expect(moveFocus("2027-04-08", "Home")).toBe("2027-04-04"); // Sunday
    expect(moveFocus("2027-04-08", "End")).toBe("2027-04-10"); // Saturday
    expect(moveFocus("2027-01-31", "PageDown")).toBe("2027-02-28");
    expect(moveFocus("2027-04-08", "PageUp", true)).toBe("2026-04-08");
    expect(moveFocus("2027-04-08", "a")).toBeNull();
    expect(shiftMonths("2027-03-31", -1)).toBe("2027-02-28");
  });
});
