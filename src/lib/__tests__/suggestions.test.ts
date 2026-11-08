import { describe, expect, it } from "vitest";
import type { TripSearch } from "../newTrip";
import { MAX_VISIBLE, RULES, suggestionsFor } from "@/components/home/suggestions";
import { ideaDepartDate, ideaMatches, monthsInRange, SEASONAL_IDEAS } from "@/components/home/ideas";
import { findCity } from "../cities";

const base: TripSearch = {
  tripType: "round",
  home: "NYC",
  to: "TYO",
  cities: [],
  stopover: { nights: 2 },
  departDate: "2027-04-02",
  returnDate: "2027-04-12",
  nights: 7,
  adults: 1,
  cabin: "economy",
};
const multi = (cities: string[], extra: Partial<TripSearch> = {}): TripSearch => ({
  ...base,
  tripType: "multi",
  to: undefined,
  cities: cities.map((city, i) => ({ key: String(i), city, nights: 3 })),
  ...extra,
});
const ids = (s: TripSearch, dismissed: string[] = []) => suggestionsFor(s, dismissed).map((x) => x.id);

describe("suggestion rules", () => {
  it("cherry-blossom season suggests Kyoto for a spring Japan trip", () => {
    const [first] = suggestionsFor(base);
    expect(first.id).toBe("sakura-kyoto");
    expect(first.action).toMatchObject({ kind: "addCity", city: "UKY" });
    expect(ids({ ...base, departDate: "2027-07-02", returnDate: "2027-07-12" })).not.toContain("sakura-kyoto");
    expect(ids(multi(["TYO", "UKY"]))).not.toContain("sakura-kyoto");
  });

  it("Hong Kong suggests the Macau ferry, unless Macau is already in", () => {
    expect(ids(multi(["SHA", "HKG"], { departDate: "2027-05-02" }))).toContain("hk-macau");
    expect(ids(multi(["HKG", "MFM"], { departDate: "2027-05-02" }))).not.toContain("hk-macau");
  });

  it("warns about Golden Week and Chinese New Year on China dates", () => {
    expect(ids({ ...base, to: "BJS", departDate: "2027-09-28", returnDate: "2027-10-06" })[0]).toBe("golden-week");
    expect(ids({ ...base, to: "BJS", departDate: "2027-02-01", returnDate: "2027-02-10" })[0]).toBe("spring-festival");
    expect(ids({ ...base, to: "BJS", departDate: "2027-05-10", returnDate: "2027-05-20" })).not.toContain("golden-week");
  });

  it("mentions a stopover programme that suits a US → Europe route", () => {
    const s = suggestionsFor({ ...base, to: "PAR", departDate: "2027-05-01", returnDate: "2027-05-10" });
    const card = s.find((x) => x.id === "stopover-programme");
    expect(card?.action).toMatchObject({ kind: "stopover", programme: "icelandair" });
    expect(ids({ ...base, tripType: "stopover", to: "PAR", stopover: { city: "REK", nights: 2 } })).not.toContain("stopover-programme");
  });

  it("hints at 240-hour transit only for a short mainland stay that ends outside the mainland", () => {
    expect(ids(multi(["BJS", "SHA", "HKG"], { departDate: "2027-05-02" }))).toContain("china-transit");
    expect(ids(multi(["HKG", "BJS"], { departDate: "2027-05-02" }))).not.toContain("china-transit");
    expect(ids(multi(["BJS", "SIA", "CTU", "SHA", "HKG"], { departDate: "2027-05-02" }))).not.toContain("china-transit"); // 12 mainland nights
  });

  it("shows at most two, and respects dismissals", () => {
    const busy = multi(["TYO", "HKG"], { departDate: "2027-04-02" });
    expect(suggestionsFor(busy)).toHaveLength(MAX_VISIBLE);
    expect(ids(busy, ["sakura-kyoto"])[0]).toBe("hk-macau");
    expect(suggestionsFor(busy, RULES.map((r) => r.id))).toEqual([]);
  });
});

describe("seasonal ideas", () => {
  it("use catalog cities only, with months 1–12", () => {
    for (const idea of SEASONAL_IDEAS) {
      for (const st of idea.stops) expect(findCity(st.city), `${idea.id} ${st.city}`).toBeDefined();
      for (const m of idea.months) expect(m >= 1 && m <= 12, idea.id).toBe(true);
    }
  });

  it("match the chosen months and pick a sensible departure", () => {
    const spring = SEASONAL_IDEAS.find((i) => i.id === "china-spring")!;
    expect(ideaMatches(spring, monthsInRange("2027-04-08", "2027-04-24"))).toBe(true);
    expect(ideaMatches(spring, monthsInRange("2027-07-01", "2027-07-10"))).toBe(false);
    expect(monthsInRange("2027-11-20", "2028-01-05")).toEqual([11, 12, 1]);
    expect(ideaDepartDate(spring, "2027-04-20", "2026-11-08")).toBe("2027-04-20");
    expect(ideaDepartDate(spring, "2027-01-03", "2026-11-08")).toBe("2027-03-10");
  });
});
