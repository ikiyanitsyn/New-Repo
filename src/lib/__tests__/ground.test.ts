import { describe, expect, it } from "vitest";
import { getCity } from "../cities";
import { defaultMode, estimateLeg } from "../ground";
import { distanceKm, greatCircle } from "../geo";
import { sampleOffers } from "../flights/sample";

describe("ground legs", () => {
  it("uses typical high-speed rail figures where known", () => {
    const e = estimateLeg(getCity("SZX"), getCity("HKG"), "train");
    expect(e.source).toBe("typical");
    expect(e.durationMin).toBeLessThan(30);
    expect(e.notes.join(" ")).toMatch(/Hong Kong border/);
  });

  it("picks train for short hops and flight for long ones", () => {
    expect(defaultMode(getCity("SHA"), getCity("HGH"))).toBe("train");
    expect(defaultMode(getCity("SHA"), getCity("TYO"))).toBe("flight");
  });

  it("warns about driving in mainland China", () => {
    expect(estimateLeg(getCity("BJS"), getCity("SIA"), "car").notes.join(" ")).toMatch(/licence/);
  });
});

describe("geo", () => {
  it("measures New York to Beijing at roughly 11,000 km", () => {
    const km = distanceKm(getCity("NYC"), getCity("BJS"));
    expect(km).toBeGreaterThan(10800);
    expect(km).toBeLessThan(11200);
  });

  it("keeps great-circle lines continuous across the antimeridian", () => {
    const pts = greatCircle(getCity("TYO"), getCity("SEA"));
    for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i][0] - pts[i - 1][0])).toBeLessThan(10);
  });
});

describe("sample fares", () => {
  it("are deterministic and scale with travellers", () => {
    const q = { from: "NYC", to: "BJS", date: "2027-04-08", adults: 1, cabin: "economy" as const, directOnly: false };
    const a = sampleOffers(q);
    expect(sampleOffers(q)).toEqual(a);
    const two = sampleOffers({ ...q, adults: 2 });
    expect(two[0].priceTotal).toBe(a[0].priceTotal * 2);
    expect(a.every((o) => o.durationMin > 700 && o.durationMin < 2400)).toBe(true);
  });
});
