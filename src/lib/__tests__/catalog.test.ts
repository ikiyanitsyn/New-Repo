import { describe, expect, it } from "vitest";
import { CITIES, flightCodeOf, getCity } from "../cities";
import { BUS_FERRY_ROUTES, defaultMode, estimateLeg, findRail, RAIL_ROUTES } from "../ground";
import { officialLinks } from "../ai/official";
import { searchLinks } from "../flights/links";
import { sampleOffers } from "../flights/sample";
import { matchScore, pickerGroups } from "@/components/CityPicker";

const CODE = /^[A-Z]{3}$/;

describe("catalog", () => {
  it("has unique three-letter codes", () => {
    const codes = CITIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(CODE);
  });

  it("keeps the codes saved trips already use", () => {
    for (const c of ["NYC", "LAX", "SFO", "CHI", "MIA", "SEA", "BJS", "SHA", "CAN", "SZX", "CTU", "CKG", "SIA", "HGH", "KWL", "HKG", "TYO", "SEL", "BKK", "SIN", "LON", "PAR", "ROM", "BCN", "AMS", "IST"])
      expect(getCity(c).code).toBe(c);
  });

  it("gives internal codes to airport-less cities without clashing with any airport or flight code", () => {
    const internal = CITIES.filter((c) => c.flightCode);
    expect(internal.map((c) => c.name)).toEqual(expect.arrayContaining(["Suzhou", "Kyoto", "Pingyao", "Hoi An", "Bruges", "Lucerne"]));
    const used = new Set(CITIES.flatMap((c) => [...c.airports, ...(c.flightCode ? [c.flightCode] : [])]));
    for (const c of internal) {
      expect(used.has(c.code), `${c.name} code ${c.code} clashes`).toBe(false);
      expect(c.flightCode).toMatch(CODE);
      expect(c.flightCode).not.toBe(c.code);
    }
  });

  it("gives every city valid coordinates, a real time zone and airports", () => {
    for (const c of CITIES) {
      expect(Math.abs(c.lat), c.name).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lon), c.name).toBeLessThanOrEqual(180);
      expect(c.lat !== 0 || c.lon !== 0, c.name).toBe(true);
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: c.timeZone }), `${c.name} ${c.timeZone}`).not.toThrow();
      expect(c.country).toMatch(/^[A-Z]{2}$/);
      expect(c.airports.length, c.name).toBeGreaterThan(0);
      for (const a of c.airports) expect(a).toMatch(CODE);
    }
  });

  it("covers the trip's focus and the new regions", () => {
    const count = (f: (c: (typeof CITIES)[number]) => boolean) => CITIES.filter(f).length;
    expect(count((c) => c.country === "CN")).toBeGreaterThanOrEqual(26);
    expect(count((c) => c.region === "Europe")).toBeGreaterThanOrEqual(35);
    expect(getCity("MFM").country).toBe("MO");
    expect(getCity("MFM").timeZone).toBe("Asia/Macau");
    expect(getCity("DXB").region).toBe("Middle East");
  });

  it("puts Chinese characters in mainland local names", () => {
    for (const c of CITIES.filter((x) => x.country === "CN")) expect(c.localName, c.name).toMatch(/^[一-鿿]+$/);
  });

  it("references only real catalog cities in the transport tables", () => {
    for (const r of [...RAIL_ROUTES, ...BUS_FERRY_ROUTES]) {
      expect(() => getCity(r.a)).not.toThrow();
      expect(() => getCity(r.b)).not.toThrow();
    }
  });
});

describe("flight codes", () => {
  const q = { date: "2027-04-08", adults: 1, cabin: "economy" as const, directOnly: false };

  it("search links use the serving airport code for cities without one", () => {
    expect(flightCodeOf(getCity("UKY"))).toBe("OSA");
    const links = searchLinks({ ...q, from: "NYC", to: "UKY" });
    const sky = links.find((l) => l.label === "Skyscanner")!.url;
    expect(sky).toContain("/nyc/osa/");
    expect(sky).not.toContain("uky");
    const gf = decodeURIComponent(links.find((l) => l.label === "Google Flights")!.url);
    expect(gf).toContain("Flights to KIX");
  });

  it("search links keep the city code where it is a real code", () => {
    const sky = searchLinks({ ...q, from: "SFO", to: "BJS" }).find((l) => l.label === "Skyscanner")!.url;
    expect(sky).toContain("/sfo/bjs/");
  });

  it("sample fares work for airport-less cities", () => {
    const offers = sampleOffers({ ...q, from: "LAX", to: "SUZ" });
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0].segments.at(-1)!.to).toMatch(/SHA|PVG|WUX/);
  });
});

describe("ground transport", () => {
  it("knows the Yangtze delta and Yunnan rail hops", () => {
    expect(estimateLeg(getCity("SHA"), getCity("SUZ"), "train")).toMatchObject({ source: "typical", durationMin: 25 });
    expect(findRail("LJG", "DLU")?.durationMin).toBeLessThan(120);
    expect(estimateLeg(getCity("NKG"), getCity("BJS"), "train").bookLinks[0].label).toMatch(/Trip\.com/);
  });

  it("uses the right booking sites per country", () => {
    const jp = estimateLeg(getCity("TYO"), getCity("UKY"), "train");
    expect(jp.source).toBe("typical");
    expect(jp.bookLinks.map((l) => l.label).join(" ")).toMatch(/SmartEX/);
    expect(estimateLeg(getCity("SEL"), getCity("PUS"), "train").bookLinks[0].url).toContain("letskorail");
    const it = estimateLeg(getCity("ROM"), getCity("FLR"), "train").bookLinks.map((l) => l.label);
    expect(it).toEqual(expect.arrayContaining(["Trenitalia", "Italo", "Trainline"]));
    expect(estimateLeg(getCity("LON"), getCity("BRU"), "train").bookLinks[0].label).toBe("Eurostar");
  });

  it("takes the ferry from Hong Kong to Macau, with both immigration checks", () => {
    const hk = getCity("HKG");
    const mo = getCity("MFM");
    expect(defaultMode(hk, mo)).toBe("ferry");
    const ferry = estimateLeg(hk, mo, "ferry");
    expect(ferry.source).toBe("typical");
    expect(ferry.durationMin).toBe(60);
    expect(ferry.bookLinks.map((l) => l.label)).toContain("TurboJET");
    expect(ferry.notes.join(" ")).toMatch(/Hong Kong ⇄ Macau border/);
    const bus = estimateLeg(mo, hk, "bus");
    expect(bus.source).toBe("typical");
    expect(bus.durationMin).toBe(45);
    expect(bus.notes.join(" ")).toMatch(/Bridge/);
  });

  it("notes Macau's own border from the mainland and Schengen's open borders", () => {
    expect(estimateLeg(getCity("CAN"), getCity("MFM"), "car").notes.join(" ")).toMatch(/Macau has its own immigration/);
    expect(estimateLeg(getCity("PAR"), getCity("BRU"), "train").notes.join(" ")).toMatch(/Schengen/);
    expect(estimateLeg(getCity("BJS"), getCity("TYO"), "flight").notes.join(" ")).not.toMatch(/Hong Kong/);
  });

  it("does not suggest a flight between cities that share airports", () => {
    expect(defaultMode(getCity("DAD"), getCity("HOI"))).toBe("bus");
    expect(defaultMode(getCity("UKY"), getCity("OSA"))).toBe("train");
    expect(estimateLeg(getCity("BRU"), getCity("BRG"), "flight").notes.join(" ")).toMatch(/share the same airports/);
  });
});

describe("official links", () => {
  it("gives a Schengen city the State Department page and ETIAS", () => {
    const [de] = officialLinks(["MUC"]);
    expect(de.country).toBe("Germany");
    const urls = de.links.map((l) => l.url);
    expect(urls).toContain("https://travel-europe.europa.eu/");
    expect(urls.some((u) => u.endsWith("/Germany.html"))).toBe(true);
  });

  it("gives Macau its own immigration source and every country a State Department page", () => {
    const [mo] = officialLinks(["MFM"]);
    expect(mo.links.map((l) => l.url).join(" ")).toMatch(/fsm\.gov\.mo/);
    for (const g of officialLinks(CITIES.map((c) => c.code))) expect(g.links[0].label, g.country).toMatch(/State Department/);
  });
});

describe("city picker", () => {
  const dest = CITIES.filter((c) => c.country !== "US");

  it("groups by region then country, with China first", () => {
    const g = pickerGroups(dest, "", [], []);
    expect(g[0]).toMatchObject({ section: "East Asia", heading: "China" });
    expect(g.find((x) => x.heading === "Italy")?.cities.map((c) => c.name)).toContain("Florence");
    expect(g.find((x) => x.key === "Southeast Asia-SG")).toMatchObject({ heading: undefined, showCountry: true });
  });

  it("suggests nearby cities for the trip first", () => {
    const g = pickerGroups(dest, "", ["SHA"], ["BJS", "SHA"]);
    expect(g[0].key).toBe("popular");
    expect(g[0].cities[0].name).toBe("Suzhou");
    expect(g[0].cities.every((c) => c.country === "CN")).toBe(true);
    expect(pickerGroups(dest, "", [], [])[0].key).not.toBe("popular");
  });

  it("finds cities by local name, accent-free spelling and airport code", () => {
    const names = (q: string) => pickerGroups(dest, q, [], []).flatMap((g) => g.cities.map((c) => c.name));
    expect(names("京都")).toEqual(["Kyoto"]);
    expect(names("zurich")).toContain("Zurich");
    expect(names("KIX")).toEqual(expect.arrayContaining(["Kyoto", "Osaka"]));
    expect(names("portugal")).toEqual(expect.arrayContaining(["Lisbon", "Porto"]));
    expect(matchScore(getCity("NCE"), "nice")).toBeLessThan(matchScore(getCity("VCE"), "nice"));
  });
});
