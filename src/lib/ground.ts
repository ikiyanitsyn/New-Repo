import { flightCodeOf, type City } from "./cities";
import { distanceKm } from "./geo";

export type Mode = "flight" | "train" | "bus" | "car" | "ferry";
export const MODES: Mode[] = ["flight", "train", "bus", "car", "ferry"];

type Link = { label: string; url: string };

export interface LegEstimate {
  mode: Mode;
  durationMin: number;
  priceUsd: number; // per person, except car (per vehicle)
  priceBasis: "per person" | "per vehicle";
  distanceKm: number;
  source: "typical" | "estimate";
  notes: string[];
  bookLinks: Link[];
}

interface RailRoute {
  a: string;
  b: string;
  durationMin: number; // fastest regular service
  priceUsd: number; // standard / second class
  service: string;
}

/**
 * Typical fastest regular rail services and standard-class fares, rounded.
 * These are planning figures, not live prices; schedules and fares change.
 * Fares converted at approximate 2026 rates (CNY 7.2, JPY 150, KRW 1,400,
 * EUR 1.10, GBP 1.27, CHF 1.15 to the dollar) and rounded.
 *
 * Compiled from operators' published timetables and fare tables as
 * remembered, without network access. European fares vary most: they are a
 * typical booked-ahead standard fare, not the cheapest promo or the walk-up
 * flexible fare. Lines marked "unsure" are the least certain.
 */
export const RAIL_ROUTES: RailRoute[] = [
  // Mainland China high-speed rail (G / D trains), China Railway 12306 second-class fares
  { a: "BJS", b: "SHA", durationMin: 258, priceUsd: 78, service: "G-train high-speed rail" },
  { a: "BJS", b: "SIA", durationMin: 264, priceUsd: 72, service: "G-train high-speed rail" },
  { a: "BJS", b: "HGH", durationMin: 270, priceUsd: 76, service: "G-train high-speed rail" },
  { a: "BJS", b: "CAN", durationMin: 480, priceUsd: 130, service: "G-train high-speed rail" },
  { a: "SIA", b: "CTU", durationMin: 185, priceUsd: 37, service: "G-train high-speed rail" },
  { a: "SIA", b: "CKG", durationMin: 320, priceUsd: 48, service: "D/G-train" },
  { a: "CTU", b: "CKG", durationMin: 62, priceUsd: 15, service: "G-train high-speed rail" },
  { a: "SHA", b: "HGH", durationMin: 45, priceUsd: 11, service: "G-train high-speed rail" },
  { a: "SHA", b: "CAN", durationMin: 405, priceUsd: 110, service: "G-train high-speed rail" },
  { a: "CAN", b: "SZX", durationMin: 30, priceUsd: 11, service: "G/C-train intercity" },
  { a: "KWL", b: "CAN", durationMin: 150, priceUsd: 20, service: "D-train high-speed rail" },
  // Yangtze delta: Shanghai Hongqiao – Suzhou ~¥40, – Nanjing South ~¥140.
  { a: "SHA", b: "SUZ", durationMin: 25, priceUsd: 6, service: "G-train high-speed rail (Hongqiao – Suzhou)" },
  { a: "SHA", b: "NKG", durationMin: 70, priceUsd: 20, service: "G-train high-speed rail" },
  { a: "SUZ", b: "NKG", durationMin: 50, priceUsd: 14, service: "G-train high-speed rail" },
  { a: "NKG", b: "HGH", durationMin: 65, priceUsd: 17, service: "G-train high-speed rail" },
  { a: "NKG", b: "BJS", durationMin: 195, priceUsd: 62, service: "G-train high-speed rail (Beijing South – Nanjing South)" },
  // Hangzhou East – Huangshan North on the Hangzhou–Huangshan line (opened 2018), ~¥125.
  { a: "HGH", b: "TXN", durationMin: 90, priceUsd: 18, service: "G-train to Huangshan North" },
  // Yunnan: Kunming – Dali – Lijiang D-trains. Lijiang station is ~20 min from the old town.
  { a: "KMG", b: "DLU", durationMin: 120, priceUsd: 20, service: "D-train high-speed rail" },
  { a: "DLU", b: "LJG", durationMin: 80, priceUsd: 10, service: "D-train" },
  { a: "KMG", b: "LJG", durationMin: 200, priceUsd: 30, service: "D-train high-speed rail" },
  // Unsure: Beijing – Qingdao fastest runs vary between about 3¾ and 4½ hours.
  { a: "BJS", b: "TAO", durationMin: 240, priceUsd: 44, service: "G-train high-speed rail" },
  // Unsure: Beijing – Harbin West via the Beijing–Harbin HSR, roughly 5 hours, ~¥600.
  { a: "BJS", b: "HRB", durationMin: 300, priceUsd: 85, service: "G-train high-speed rail" },
  // Xi'an North – Luoyang Longmen, ~¥175.
  { a: "SIA", b: "LYA", durationMin: 85, priceUsd: 25, service: "G-train high-speed rail" },
  { a: "BJS", b: "LYA", durationMin: 240, priceUsd: 57, service: "G-train high-speed rail" },
  // Unsure: Pingyao Gucheng station has direct G/D trains to Beijing West and Xi'an North.
  { a: "BJS", b: "PYO", durationMin: 240, priceUsd: 42, service: "G/D-train to Pingyao Gucheng" },
  { a: "SIA", b: "PYO", durationMin: 180, priceUsd: 30, service: "G/D-train to Pingyao Gucheng" },
  // Unsure: via the coastal line through Shenzhen and Shantou.
  { a: "CAN", b: "XMN", durationMin: 225, priceUsd: 40, service: "G/D-train high-speed rail" },
  { a: "SZX", b: "XMN", durationMin: 180, priceUsd: 30, service: "G/D-train high-speed rail" },
  // Unsure: Changsha South – Zhangjiajie West via Changde (line completed 2022).
  { a: "CSX", b: "DYG", durationMin: 125, priceUsd: 22, service: "G-train high-speed rail" },
  { a: "CSX", b: "CAN", durationMin: 140, priceUsd: 44, service: "G-train high-speed rail" },
  { a: "CSX", b: "BJS", durationMin: 340, priceUsd: 90, service: "G-train high-speed rail" },
  // Guiyang North on the Guiyang–Guangzhou and Chongqing–Guiyang lines.
  { a: "KWE", b: "KWL", durationMin: 130, priceUsd: 23, service: "D/G-train high-speed rail" },
  { a: "KWE", b: "CKG", durationMin: 120, priceUsd: 18, service: "G-train high-speed rail" },
  // Unsure: Shanghai–Kunming HSR section.
  { a: "KWE", b: "KMG", durationMin: 140, priceUsd: 28, service: "G-train high-speed rail" },

  // Mainland ⇄ Hong Kong via West Kowloon station (immigration at the station)
  { a: "SZX", b: "HKG", durationMin: 15, priceUsd: 10, service: "Guangzhou–Shenzhen–Hong Kong Express Rail Link" },
  { a: "CAN", b: "HKG", durationMin: 48, priceUsd: 30, service: "Guangzhou–Shenzhen–Hong Kong Express Rail Link" },
  { a: "KWL", b: "HKG", durationMin: 185, priceUsd: 45, service: "High-speed rail to West Kowloon" },
  { a: "SHA", b: "HKG", durationMin: 480, priceUsd: 140, service: "High-speed rail to West Kowloon" },
  { a: "BJS", b: "HKG", durationMin: 536, priceUsd: 150, service: "High-speed rail to West Kowloon" },

  // Japan: Tokaido–Sanyo Shinkansen (Nozomi), reserved ordinary seat, ~¥14,200 / ¥14,700 / ¥10,600.
  { a: "TYO", b: "UKY", durationMin: 135, priceUsd: 95, service: "Nozomi shinkansen (Tokyo – Kyoto)" },
  { a: "TYO", b: "OSA", durationMin: 150, priceUsd: 100, service: "Nozomi shinkansen (Tokyo – Shin-Osaka)" },
  { a: "OSA", b: "HIJ", durationMin: 85, priceUsd: 70, service: "Nozomi shinkansen (Shin-Osaka – Hiroshima)" },
  { a: "UKY", b: "HIJ", durationMin: 100, priceUsd: 78, service: "Nozomi shinkansen" },
  { a: "TYO", b: "HIJ", durationMin: 240, priceUsd: 130, service: "Nozomi shinkansen" },
  // JR Special Rapid, ~¥580 (the shinkansen is 14 min but costs more and runs station to station).
  { a: "UKY", b: "OSA", durationMin: 29, priceUsd: 4, service: "JR Special Rapid (Kyoto – Osaka)" },

  // Korea: KTX Seoul – Busan, ~₩59,800 standard.
  { a: "SEL", b: "PUS", durationMin: 140, priceUsd: 43, service: "KTX high-speed rail" },

  // Europe
  { a: "LON", b: "PAR", durationMin: 136, priceUsd: 90, service: "Eurostar" },
  { a: "LON", b: "AMS", durationMin: 235, priceUsd: 95, service: "Eurostar" },
  { a: "PAR", b: "AMS", durationMin: 198, priceUsd: 75, service: "Eurostar" },
  { a: "PAR", b: "BCN", durationMin: 390, priceUsd: 90, service: "TGV / AVE high-speed rail" },
  { a: "LON", b: "BRU", durationMin: 121, priceUsd: 90, service: "Eurostar" },
  { a: "PAR", b: "BRU", durationMin: 82, priceUsd: 65, service: "Eurostar (formerly Thalys)" },
  { a: "BRU", b: "AMS", durationMin: 110, priceUsd: 50, service: "Eurostar (formerly Thalys)" },
  // SNCB InterCity Brussels-Midi – Brugge, fixed fare ~€16.
  { a: "BRU", b: "BRG", durationMin: 60, priceUsd: 17, service: "SNCB InterCity" },
  { a: "LON", b: "EDI", durationMin: 260, priceUsd: 80, service: "LNER Azuma (King's Cross – Edinburgh)" },
  { a: "PAR", b: "LYS", durationMin: 120, priceUsd: 60, service: "TGV INOUI / OUIGO" },
  { a: "PAR", b: "NCE", durationMin: 340, priceUsd: 85, service: "TGV INOUI" },
  { a: "PAR", b: "ZRH", durationMin: 245, priceUsd: 90, service: "TGV Lyria" },
  // Italy: Frecciarossa / Italo standard fares booked ahead.
  { a: "ROM", b: "FLR", durationMin: 92, priceUsd: 45, service: "Frecciarossa / Italo high-speed rail" },
  { a: "ROM", b: "NAP", durationMin: 70, priceUsd: 40, service: "Frecciarossa / Italo high-speed rail" },
  { a: "ROM", b: "MIL", durationMin: 175, priceUsd: 75, service: "Frecciarossa / Italo high-speed rail" },
  { a: "ROM", b: "VCE", durationMin: 225, priceUsd: 70, service: "Frecciarossa / Italo high-speed rail" },
  { a: "FLR", b: "MIL", durationMin: 115, priceUsd: 50, service: "Frecciarossa / Italo high-speed rail" },
  { a: "FLR", b: "VCE", durationMin: 125, priceUsd: 40, service: "Frecciarossa / Italo high-speed rail" },
  { a: "MIL", b: "VCE", durationMin: 145, priceUsd: 35, service: "Frecciarossa / Italo high-speed rail" },
  { a: "NAP", b: "FLR", durationMin: 175, priceUsd: 65, service: "Frecciarossa / Italo high-speed rail" },
  // Switzerland and the Alps (SBB full fare; a Half Fare Card halves it).
  { a: "ZRH", b: "LUZ", durationMin: 45, priceUsd: 30, service: "SBB InterRegio" },
  { a: "ZRH", b: "MIL", durationMin: 200, priceUsd: 60, service: "EuroCity via the Gotthard Base Tunnel" },
  { a: "LUZ", b: "MIL", durationMin: 200, priceUsd: 60, service: "EuroCity via the Gotthard Base Tunnel" },
  { a: "MUC", b: "ZRH", durationMin: 210, priceUsd: 65, service: "EuroCity Express" },
  // Iberia
  { a: "MAD", b: "BCN", durationMin: 150, priceUsd: 60, service: "AVE / Iryo / OUIGO high-speed rail" },
  { a: "MAD", b: "SVQ", durationMin: 150, priceUsd: 55, service: "AVE high-speed rail" },
  { a: "LIS", b: "OPO", durationMin: 170, priceUsd: 35, service: "CP Alfa Pendular" },
  // Central Europe
  { a: "BER", b: "MUC", durationMin: 240, priceUsd: 90, service: "ICE Sprinter" },
  { a: "MUC", b: "VIE", durationMin: 235, priceUsd: 65, service: "ÖBB Railjet" },
  { a: "VIE", b: "PRG", durationMin: 240, priceUsd: 35, service: "ÖBB Railjet" },
  { a: "VIE", b: "BUD", durationMin: 160, priceUsd: 30, service: "ÖBB Railjet" },
  { a: "PRG", b: "BER", durationMin: 255, priceUsd: 40, service: "EuroCity" },
  // Unsure: Vienna – Kraków direct trains run about 4½–5 hours.
  { a: "VIE", b: "KRK", durationMin: 285, priceUsd: 45, service: "EuroCity / ÖBB Railjet" },
  // Scandinavia. Unsure: Stockholm – Oslo direct trains vary from about 5½ to 6 hours.
  { a: "CPH", b: "STO", durationMin: 315, priceUsd: 70, service: "SJ high-speed (X2000)" },
  { a: "STO", b: "OSL", durationMin: 350, priceUsd: 60, service: "SJ / Vy InterCity" },
];

export function findRail(a: string, b: string): RailRoute | undefined {
  return RAIL_ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

interface RoadSeaRoute {
  a: string;
  b: string;
  mode: "bus" | "ferry";
  durationMin: number; // on board, door-to-door extras in `notes`
  priceUsd: number; // standard / economy class, per person
  service: string;
  notes?: string[];
  links?: Link[];
}

/**
 * Typical bus and ferry routes that beat the generic estimate, used when the
 * leg's mode is bus or ferry. Same caveats as the rail table.
 */
export const BUS_FERRY_ROUTES: RoadSeaRoute[] = [
  // TurboJET / Cotai Water Jet economy, ~HK$175–200 one way.
  {
    a: "HKG", b: "MFM", mode: "ferry", durationMin: 60, priceUsd: 24,
    service: "High-speed ferry (Sheung Wan or Tsim Sha Tsui to Macau Outer Harbour or Taipa)",
    notes: ["Ferries run from early morning to late evening, several an hour at busy times."],
    links: [
      { label: "TurboJET", url: "https://www.turbojet.com.hk/en/" },
      { label: "Cotai Water Jet", url: "https://www.cotaiwaterjet.com/" },
    ],
  },
  // HZMB shuttle bus ~HK$65 by day; the crossing itself is about 45 minutes.
  {
    a: "HKG", b: "MFM", mode: "bus", durationMin: 45, priceUsd: 9,
    service: "Hong Kong–Zhuhai–Macau Bridge shuttle bus",
    notes: [
      "The 45 minutes is the bridge crossing. Allow about an hour more for getting to the Hong Kong Port on Lantau and for immigration at both ends.",
      "Shuttle buses run around the clock.",
    ],
    links: [{ label: "HZMB shuttle bus", url: "https://www.hzmbus.com/" }],
  },
  // High-speed ferry from Piraeus ~€80–100; conventional ferries take 7–8 hours for about half the price.
  {
    a: "ATH", b: "JTR", mode: "ferry", durationMin: 300, priceUsd: 95,
    service: "High-speed ferry from Piraeus",
    notes: ["Conventional ferries take 7–8 hours for about half the fare. Summer seas can be rough."],
    links: [{ label: "Ferryhopper", url: "https://www.ferryhopper.com/" }],
  },
  // Unsure: shuttle buses and shared transfers vary; a private car is about $15 for the whole car.
  {
    a: "DAD", b: "HOI", mode: "bus", durationMin: 45, priceUsd: 5,
    service: "Shuttle bus or shared transfer",
    notes: ["A Grab car is easy and costs about $15 for the whole car."],
  },
  // Express coach, typically RM 50–150 depending on comfort.
  {
    a: "KUL", b: "SIN", mode: "bus", durationMin: 330, priceUsd: 25,
    service: "Express coach",
    notes: ["Border checks at Johor Bahru and Woodlands can add an hour at busy times."],
  },
];

export function findBusFerry(mode: Mode, a: string, b: string): RoadSeaRoute | undefined {
  return BUS_FERRY_ROUTES.find((r) => r.mode === mode && ((r.a === a && r.b === b) || (r.a === b && r.b === a)));
}

/** Places with no intercity railway, so a train leg there needs another plan. */
const NO_RAIL = new Set(["MFM", "HOI", "JTR", "CJU", "DPS", "HKT", "DBV", "REK", "HNL"]);

const CHINA = new Set(["CN", "HK", "MO"]);

/** Schengen members in the catalog (no routine passport checks between them). */
const SCHENGEN = new Set(["FR", "IT", "ES", "PT", "NL", "BE", "DE", "CH", "AT", "CZ", "HU", "PL", "HR", "GR", "DK", "SE", "NO", "IS"]);

/** Rail operators that sell tickets online in English, by country. */
const RAIL_BOOKING: Record<string, Link[]> = {
  JP: [
    { label: "SmartEX (Tokaido–Sanyo Shinkansen)", url: "https://smart-ex.jp/en/" },
    { label: "JR-West online booking", url: "https://www.westjr.co.jp/global/en/" },
  ],
  KR: [{ label: "Korail (Let's Korail)", url: "https://www.letskorail.com/" }],
  TW: [{ label: "Taiwan High Speed Rail", url: "https://en.thsrc.com.tw/" }],
  IT: [
    { label: "Trenitalia", url: "https://www.trenitalia.com/en.html" },
    { label: "Italo", url: "https://www.italotreno.com/en" },
  ],
  ES: [{ label: "Renfe", url: "https://www.renfe.com/es/en" }],
  PT: [{ label: "CP – Comboios de Portugal", url: "https://www.cp.pt/passageiros/en" }],
  FR: [{ label: "SNCF Connect", url: "https://www.sncf-connect.com/en-en/" }],
  DE: [{ label: "Deutsche Bahn", url: "https://int.bahn.de/en" }],
  AT: [{ label: "ÖBB", url: "https://www.oebb.at/en/" }],
  CH: [{ label: "SBB", url: "https://www.sbb.ch/en" }],
  CZ: [{ label: "České dráhy", url: "https://www.cd.cz/en/" }],
  PL: [{ label: "PKP Intercity", url: "https://www.intercity.pl/en/" }],
  BE: [{ label: "SNCB", url: "https://www.belgiantrain.be/en" }],
  NL: [{ label: "NS International", url: "https://www.nsinternational.com/en" }],
  GB: [{ label: "National Rail", url: "https://www.nationalrail.co.uk/" }],
  DK: [{ label: "DSB", url: "https://www.dsb.dk/en/" }],
  SE: [{ label: "SJ", url: "https://www.sj.se/en" }],
  NO: [{ label: "Vy", url: "https://www.vy.no/en" }],
};

const dedupe = (links: Link[]) => links.filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i);

function bookLinks(mode: Mode, from: City, to: City, service?: string, routeLinks?: Link[]): Link[] {
  const q = (s: string) => encodeURIComponent(s);
  const inChina = CHINA.has(from.country) && CHINA.has(to.country);
  const inEurope = from.region === "Europe" && to.region === "Europe";
  if (routeLinks?.length) return routeLinks;
  switch (mode) {
    case "train": {
      if (inChina)
        return [
          { label: "Trip.com trains", url: "https://www.trip.com/trains/china/" },
          { label: "China Railway 12306", url: "https://www.12306.cn/en/index.html" },
        ];
      const operators = [
        ...(service?.includes("Eurostar") ? [{ label: "Eurostar", url: "https://www.eurostar.com/" }] : []),
        ...(RAIL_BOOKING[from.country] ?? []),
        ...(from.country !== to.country ? RAIL_BOOKING[to.country] ?? [] : []),
      ];
      if (inEurope) return dedupe([...operators.slice(0, 3), { label: "Trainline", url: "https://www.thetrainline.com/" }]);
      if (operators.length) return dedupe(operators);
      return from.region === "Southeast Asia"
        ? [{ label: "12Go", url: "https://12go.asia/en" }]
        : [{ label: "Omio", url: "https://www.omio.com/" }];
    }
    case "bus":
      if (inEurope) return [{ label: "FlixBus", url: "https://www.flixbus.com/" }, { label: "Omio", url: "https://www.omio.com/" }];
      if (inChina) return [{ label: "Trip.com", url: "https://www.trip.com/" }];
      return [{ label: "12Go", url: "https://12go.asia/en" }];
    case "car":
      return [
        {
          label: inChina ? "Route on Google Maps (limited in China)" : "Route on Google Maps",
          url: `https://www.google.com/maps/dir/?api=1&origin=${q(from.name + ", " + from.countryName)}&destination=${q(to.name + ", " + to.countryName)}&travelmode=driving`,
        },
      ];
    case "ferry":
      return inEurope
        ? [{ label: "Ferryhopper", url: "https://www.ferryhopper.com/" }, { label: "Direct Ferries", url: "https://www.directferries.com/" }]
        : [{ label: "Direct Ferries", url: "https://www.directferries.com/" }];
    case "flight":
      return [];
  }
}

/** A plain-English note about the border, or nothing within one country. */
function borderNotes(from: City, to: City): string[] {
  if (from.country === to.country) return [];
  const pair = new Set([from.country, to.country]);
  const mainlandReentry = "Coming back into mainland China later counts as a new entry, so check your visa or visa-free allowance.";
  if (pair.has("CN") && pair.has("HK"))
    return ["Crosses the mainland China ⇄ Hong Kong border: you exit and re-enter immigration.", mainlandReentry];
  if (pair.has("CN") && pair.has("MO"))
    return ["Crosses the mainland China ⇄ Macau border: Macau has its own immigration, so you exit one and enter the other.", mainlandReentry];
  if (pair.has("HK") && pair.has("MO"))
    return ["Hong Kong ⇄ Macau border: two separate immigration checks, leaving Hong Kong and entering Macau. Bring your passport."];
  if (SCHENGEN.has(from.country) && SCHENGEN.has(to.country))
    return [`${from.countryName} → ${to.countryName}, both in the Schengen area: usually no passport control, but carry your passport.`];
  return [`International border: ${from.countryName} → ${to.countryName}.`];
}

/** Estimate time and cost for one ground or short-haul leg. */
export function estimateLeg(from: City, to: City, mode: Mode): LegEstimate {
  const km = distanceKm(from, to);
  const notes: string[] = [];
  let durationMin: number;
  let priceUsd: number;
  let source: LegEstimate["source"] = "estimate";
  let priceBasis: LegEstimate["priceBasis"] = "per person";
  let service: string | undefined;
  let routeLinks: Link[] | undefined;

  switch (mode) {
    case "train": {
      const rail = findRail(from.code, to.code);
      if (rail) {
        durationMin = rail.durationMin;
        priceUsd = rail.priceUsd;
        source = "typical";
        service = rail.service;
        notes.push(rail.service);
      } else {
        durationMin = 30 + ((km * 1.2) / 120) * 60;
        priceUsd = Math.max(15, km * 0.12);
        const noRail = [from, to].find((c) => NO_RAIL.has(c.code));
        notes.push(
          noRail
            ? `No railway serves ${noRail.name}. This is a rough figure; a bus, ferry or flight is likely the real choice.`
            : "No direct fast rail on file; time assumes conventional rail.",
        );
      }
      if (from.country === "CN" || from.country === "HK") notes.push("Bring your passport: it is your ticket and is checked at the station.");
      break;
    }
    case "bus":
    case "ferry": {
      const route = findBusFerry(mode, from.code, to.code);
      if (route) {
        durationMin = route.durationMin;
        priceUsd = route.priceUsd;
        source = "typical";
        notes.push(route.service, ...(route.notes ?? []));
        routeLinks = route.links;
      } else if (mode === "bus") {
        durationMin = 20 + ((km * 1.2) / 75) * 60;
        priceUsd = Math.max(8, km * 0.06);
      } else {
        durationMin = 30 + (km / 35) * 60;
        priceUsd = Math.max(20, km * 0.15);
        notes.push("Ferries serve limited routes. Check schedules before relying on this leg.");
      }
      break;
    }
    case "car":
      durationMin = ((km * 1.2) / 90) * 60;
      priceUsd = Math.max(40, km * 1.2 * 0.22);
      priceBasis = "per vehicle";
      notes.push("Rental and fuel estimate.");
      if (from.country === "CN" || to.country === "CN")
        notes.push("Driving in mainland China needs a Chinese licence or temporary permit; a car with driver is easier.");
      break;
    case "flight":
      durationMin = 45 + (km / 750) * 60;
      priceUsd = Math.max(60, km * 0.11);
      notes.push("Add about 2½ hours for airport time. Search live fares for real prices.");
      if (flightCodeOf(from) === flightCodeOf(to)) notes.push(`${from.name} and ${to.name} share the same airports, so there is no flight between them.`);
      break;
  }

  notes.push(...borderNotes(from, to));

  return {
    mode,
    durationMin: Math.round(durationMin),
    priceUsd: Math.round(priceUsd),
    priceBasis,
    distanceKm: km,
    source,
    notes,
    bookLinks: bookLinks(mode, from, to, service, routeLinks),
  };
}

/** Sensible default mode between two stops. */
export function defaultMode(from: City, to: City): Mode {
  if (findRail(from.code, to.code)) return "train";
  // Ferry first: on Hong Kong ⇄ Macau it is the simpler door-to-door choice.
  if (findBusFerry("ferry", from.code, to.code)) return "ferry";
  if (findBusFerry("bus", from.code, to.code)) return "bus";
  const km = distanceKm(from, to);
  const sameAirport = flightCodeOf(from) === flightCodeOf(to);
  if (NO_RAIL.has(from.code) || NO_RAIL.has(to.code)) return sameAirport || km < 150 ? "car" : "flight";
  return km < 500 || sameAirport ? "train" : "flight";
}
