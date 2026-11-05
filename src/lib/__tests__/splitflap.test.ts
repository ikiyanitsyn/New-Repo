import { describe, expect, it } from "vitest";
import { FLAP_DEFAULTS, flapDuration, flapFrame, flapPlan, flapSequence } from "@/lib/splitflap";

describe("flapSequence", () => {
  it("runs up the drum to the target letter", () => {
    expect(flapSequence("D", 3)).toEqual(["A", "B", "C", "D"]);
    expect(flapSequence("B", 3)).toEqual(["Y", "Z", "A", "B"]);
  });
  it("cycles digits through digits", () => {
    expect(flapSequence("1", 3)).toEqual(["8", "9", "0", "1"]);
  });
  it("doesn't flip punctuation or spaces", () => {
    expect(flapSequence(":", 5)).toEqual([":"]);
    expect(flapSequence(" ", 5)).toEqual([" "]);
  });
  it("always ends on the target", () => {
    for (const ch of "NYC0959") expect(flapSequence(ch, 6).at(-1)).toBe(ch);
  });
});

describe("flapPlan", () => {
  it("staggers cells left to right", () => {
    const plan = flapPlan("NYC");
    expect(plan.map((c) => c.start)).toEqual([0, FLAP_DEFAULTS.staggerMs, 2 * FLAP_DEFAULTS.staggerMs]);
    expect(flapPlan("NYC", { delayMs: 100 })[0].start).toBe(100);
  });
  it("finishes within the time budget, with fast mechanical flips", () => {
    for (const v of ["NYC", "BJS", "13:05", "CA 982", "LONGER"]) {
      const d = flapDuration(flapPlan(v));
      expect(d).toBeGreaterThanOrEqual(250);
      expect(d).toBeLessThanOrEqual(700);
    }
    expect(FLAP_DEFAULTS.flipMs).toBeGreaterThanOrEqual(40);
    expect(FLAP_DEFAULTS.flipMs).toBeLessThanOrEqual(60);
  });
});

describe("flapFrame", () => {
  it("shows scrambled characters at first and the value at the end", () => {
    const plan = flapPlan("PEK");
    expect(flapFrame(plan, 0).join("")).not.toBe("PEK");
    expect(flapFrame(plan, flapDuration(plan)).join("")).toBe("PEK");
    expect(flapFrame(plan, 10_000).join("")).toBe("PEK");
  });
  it("settles the left cell before the right one", () => {
    const plan = flapPlan("AAA");
    const t = plan[0].start + (plan[0].seq.length - 1) * FLAP_DEFAULTS.flipMs;
    const f = flapFrame(plan, t);
    expect(f[0]).toBe("A");
    expect(f[2]).not.toBe("A");
  });
});
