import type { City } from "./cities";
import { distanceKm } from "./geo";

export type Mode = "flight" | "train" | "bus" | "car" | "ferry";
export const MODES: Mode[] = ["flight", "train", "bus", "car", "ferry"];

export interface LegEstimate {
  mode: Mode;
  durationMin: number;
  priceUsd: number; // per person, except car (per vehicle)
  priceBasis: "per person" | "per vehicle";
  distanceKm: number;
  source: "typical" | "estimate";
  notes: string[];
  bookLinks: { label: string; url: string }[];
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
 * Fares converted from CNY / EUR / GBP at approximate 2026 rates.
 */
export const RAIL_ROUTES: RailRoute[] = [
  // Mainland China high-speed rail (G / D trains)
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
  // Mainland ⇄ Hong Kong via West Kowloon station (immigration at the station)
  { a: "SZX", b: "HKG", durationMin: 15, priceUsd: 10, service: "Guangzhou–Shenzhen–Hong Kong Express Rail Link" },
  { a: "CAN", b: "HKG", durationMin: 48, priceUsd: 30, service: "Guangzhou–Shenzhen–Hong Kong Express Rail Link" },
  { a: "KWL", b: "HKG", durationMin: 185, priceUsd: 45, service: "High-speed rail to West Kowloon" },
  { a: "SHA", b: "HKG", durationMin: 480, priceUsd: 140, service: "High-speed rail to West Kowloon" },
  { a: "BJS", b: "HKG", durationMin: 536, priceUsd: 150, service: "High-speed rail to West Kowloon" },
  // Europe
  { a: "LON", b: "PAR", durationMin: 136, priceUsd: 90, service: "Eurostar" },
  { a: "LON", b: "AMS", durationMin: 235, priceUsd: 95, service: "Eurostar" },
  { a: "PAR", b: "AMS", durationMin: 198, priceUsd: 75, service: "Eurostar" },
  { a: "PAR", b: "BCN", durationMin: 390, priceUsd: 90, service: "TGV / AVE high-speed rail" },
];

export function findRail(a: string, b: string): RailRoute | undefined {
  return RAIL_ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

const CHINA = new Set(["CN", "HK"]);

function bookLinks(mode: Mode, from: City, to: City): { label: string; url: string }[] {
  const q = (s: string) => encodeURIComponent(s);
  const inChina = CHINA.has(from.country) && CHINA.has(to.country);
  const inEurope = from.region === "Europe" && to.region === "Europe";
  switch (mode) {
    case "train":
      if (inChina)
        return [
          { label: "Trip.com trains", url: "https://www.trip.com/trains/china/" },
          { label: "China Railway 12306", url: "https://www.12306.cn/en/index.html" },
        ];
      if (inEurope)
        return [
          { label: "Trainline", url: "https://www.thetrainline.com/" },
          { label: "Omio", url: `https://www.omio.com/` },
        ];
      return [{ label: "Omio", url: "https://www.omio.com/" }];
    case "bus":
      return from.region === "Europe"
        ? [{ label: "FlixBus", url: "https://www.flixbus.com/" }, { label: "Omio", url: "https://www.omio.com/" }]
        : [{ label: "12Go", url: "https://12go.asia/en" }];
    case "car":
      return [
        {
          label: inChina ? "Route on Google Maps (limited in China)" : "Route on Google Maps",
          url: `https://www.google.com/maps/dir/?api=1&origin=${q(from.name + ", " + from.countryName)}&destination=${q(to.name + ", " + to.countryName)}&travelmode=driving`,
        },
      ];
    case "ferry":
      return [{ label: "Direct Ferries", url: "https://www.directferries.com/" }];
    case "flight":
      return [];
  }
}

/** Estimate time and cost for one ground or short-haul leg. */
export function estimateLeg(from: City, to: City, mode: Mode): LegEstimate {
  const km = distanceKm(from, to);
  const notes: string[] = [];
  let durationMin: number;
  let priceUsd: number;
  let source: LegEstimate["source"] = "estimate";
  let priceBasis: LegEstimate["priceBasis"] = "per person";

  switch (mode) {
    case "train": {
      const rail = findRail(from.code, to.code);
      if (rail) {
        durationMin = rail.durationMin;
        priceUsd = rail.priceUsd;
        source = "typical";
        notes.push(rail.service);
      } else {
        durationMin = 30 + ((km * 1.2) / 120) * 60;
        priceUsd = Math.max(15, km * 0.12);
        notes.push("No direct fast rail on file; time assumes conventional rail.");
      }
      if (CHINA.has(from.country)) notes.push("Bring your passport: it is your ticket and is checked at the station.");
      break;
    }
    case "bus":
      durationMin = 20 + ((km * 1.2) / 75) * 60;
      priceUsd = Math.max(8, km * 0.06);
      break;
    case "car":
      durationMin = ((km * 1.2) / 90) * 60;
      priceUsd = Math.max(40, km * 1.2 * 0.22);
      priceBasis = "per vehicle";
      notes.push("Rental and fuel estimate.");
      if (from.country === "CN" || to.country === "CN")
        notes.push("Driving in mainland China needs a Chinese licence or temporary permit; a car with driver is easier.");
      break;
    case "ferry":
      durationMin = 30 + (km / 35) * 60;
      priceUsd = Math.max(20, km * 0.15);
      notes.push("Ferries serve limited routes. Check schedules before relying on this leg.");
      break;
    case "flight":
      durationMin = 45 + (km / 750) * 60;
      priceUsd = Math.max(60, km * 0.11);
      notes.push("Add about 2½ hours for airport time. Search live fares for real prices.");
      break;
  }

  if (from.country !== to.country) {
    notes.push(
      from.country === "CN" || to.country === "CN"
        ? "Crosses the mainland China ⇄ Hong Kong border: you exit and re-enter immigration."
        : `International border: ${from.countryName} → ${to.countryName}.`,
    );
  }

  return {
    mode,
    durationMin: Math.round(durationMin),
    priceUsd: Math.round(priceUsd),
    priceBasis,
    distanceKm: km,
    source,
    notes,
    bookLinks: bookLinks(mode, from, to),
  };
}

/** Sensible default mode between two stops. */
export function defaultMode(from: City, to: City): Mode {
  if (findRail(from.code, to.code)) return "train";
  return distanceKm(from, to) < 500 ? "train" : "flight";
}
