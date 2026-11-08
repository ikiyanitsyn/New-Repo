import { describe, expect, it } from "vitest";
import { findCity } from "../cities";
import { programmesFor, STOPOVER_PROGRAMMES } from "../stopovers";

describe("stopover programmes data", () => {
  it("every entry links to an https terms page and has the basics", () => {
    const ids = new Set<string>();
    for (const p of STOPOVER_PROGRAMMES) {
      expect(new URL(p.termsUrl).protocol, p.id).toBe("https:");
      expect(p.airline.trim(), p.id).not.toBe("");
      expect(p.benefit.length, p.id).toBeGreaterThan(30);
      expect(p.suits.length, p.id).toBeGreaterThan(0);
      expect(p.verifiedNote.trim(), p.id).not.toBe("");
      expect(ids.has(p.id), `duplicate ${p.id}`).toBe(false);
      ids.add(p.id);
    }
  });

  it("hub cities, when set, are in the catalog and outside the US", () => {
    for (const p of STOPOVER_PROGRAMMES.filter((x) => x.hubCity)) {
      const c = findCity(p.hubCity!);
      expect(c, p.id).toBeDefined();
      expect(c!.country, p.id).not.toBe("US");
    }
  });

  it("covers the programmes the owner asked for", () => {
    const airlines = STOPOVER_PROGRAMMES.map((p) => p.airline).join(" ");
    for (const a of ["Icelandair", "TAP", "Turkish", "Qatar", "Finnair", "Singapore", "Emirates"]) expect(airlines).toContain(a);
  });

  it("suggests programmes that suit the route, never the destination itself", () => {
    const europe = programmesFor("NYC", "PAR").map((p) => p.id);
    expect(europe).toContain("icelandair");
    expect(europe).toContain("tap");
    expect(europe).not.toContain("singapore");
    expect(programmesFor("NYC", "LIS").map((p) => p.id)).not.toContain("tap");
    // China's transit policy is for passing through China, not for a China trip.
    expect(programmesFor("NYC", "BJS").map((p) => p.id)).not.toContain("china-transit");
    expect(programmesFor("NYC", "SEL").map((p) => p.id)).toContain("china-transit");
    expect(programmesFor("NYC", "NYC")).toEqual([]);
  });
});
