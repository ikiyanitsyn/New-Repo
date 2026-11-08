import type { TripType } from "@/lib/trip";

/**
 * Seasonal trip ideas for the home page. Curated, not generated: each has the
 * months it is best in (1 = January), a route of catalog cities and nights.
 * Tapping one fills the search; ideas whose months match the chosen dates
 * are highlighted. Add or tune ideas here.
 */

export interface SeasonalIdea {
  id: string;
  title: string;
  blurb: string;
  months: number[];
  stops: { city: string; nights: number }[];
}

export const SEASONAL_IDEAS: SeasonalIdea[] = [
  {
    id: "china-spring",
    title: "Spring in China",
    blurb: "Mild days and blossom from the Great Wall to the Bund, ending in Hong Kong.",
    months: [3, 4, 5],
    stops: [
      { city: "BJS", nights: 4 },
      { city: "SIA", nights: 2 },
      { city: "CTU", nights: 3 },
      { city: "SHA", nights: 3 },
      { city: "HKG", nights: 3 },
    ],
  },
  {
    id: "japan-sakura",
    title: "Cherry blossom in Japan",
    blurb: "Tokyo's parks, then Kyoto's temples at peak bloom, late March to mid April.",
    months: [3, 4],
    stops: [
      { city: "TYO", nights: 4 },
      { city: "UKY", nights: 3 },
      { city: "OSA", nights: 2 },
    ],
  },
  {
    id: "kyoto-autumn",
    title: "Autumn leaves in Kyoto",
    blurb: "Maples turn crimson from mid November; pair with a few days in Tokyo.",
    months: [11],
    stops: [
      { city: "TYO", nights: 3 },
      { city: "UKY", nights: 4 },
    ],
  },
  {
    id: "christmas-markets",
    title: "Christmas markets in Vienna & Prague",
    blurb: "Mulled wine, carols and lit squares, late November to Christmas.",
    months: [11, 12],
    stops: [
      { city: "VIE", nights: 3 },
      { city: "PRG", nights: 3 },
      { city: "BUD", nights: 2 },
    ],
  },
  {
    id: "harbin-ice",
    title: "Harbin Ice & Snow Festival",
    blurb: "Palaces of ice lit at night, January into February. Wrap up warm.",
    months: [1, 2],
    stops: [
      { city: "BJS", nights: 3 },
      { city: "HRB", nights: 3 },
    ],
  },
  {
    id: "guilin-autumn",
    title: "Golden autumn in Guilin",
    blurb: "Clear skies over the karst peaks and the Li River, September to November.",
    months: [9, 10, 11],
    stops: [
      { city: "SHA", nights: 3 },
      { city: "KWL", nights: 3 },
      { city: "HKG", nights: 3 },
    ],
  },
  {
    id: "hk-macau-winter",
    title: "Hong Kong & Macau in winter",
    blurb: "Cool, dry and clear: the best months for harbour views and hikes.",
    months: [11, 12, 1, 2],
    stops: [
      { city: "HKG", nights: 4 },
      { city: "MFM", nights: 2 },
    ],
  },
  {
    id: "seoul-autumn",
    title: "Autumn in Korea",
    blurb: "Palace gardens in colour in Seoul, then the coast at Busan.",
    months: [10, 11],
    stops: [
      { city: "SEL", nights: 4 },
      { city: "PUS", nights: 2 },
    ],
  },
  {
    id: "iceland-lights",
    title: "Northern lights in Iceland",
    blurb: "Long dark nights, September to March, a short hop from the East Coast.",
    months: [9, 10, 11, 12, 1, 2, 3],
    stops: [{ city: "REK", nights: 4 }],
  },
  {
    id: "portugal-early-summer",
    title: "Lisbon & Porto before the crowds",
    blurb: "Warm, bright and calmer in May, June and September.",
    months: [5, 6, 9],
    stops: [
      { city: "LIS", nights: 4 },
      { city: "OPO", nights: 3 },
    ],
  },
  {
    id: "sea-dry-season",
    title: "Southeast Asia in the dry season",
    blurb: "Bangkok, the hills of Chiang Mai and Singapore, December to February.",
    months: [12, 1, 2],
    stops: [
      { city: "BKK", nights: 3 },
      { city: "CNX", nights: 3 },
      { city: "SIN", nights: 2 },
    ],
  },
];

export const ideaTripType = (idea: SeasonalIdea): TripType => (idea.stops.length > 1 ? "multi" : "round");

export const ideaNights = (idea: SeasonalIdea) => idea.stops.reduce((n, s) => n + s.nights, 0);

/** Months covered by a date range (inclusive), as 1–12. */
export function monthsInRange(start: string, end?: string): number[] {
  const out = new Set<number>();
  const a = new Date(start + "T00:00:00Z");
  const b = new Date((end ?? start) + "T00:00:00Z");
  const d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
  while (d <= b && out.size < 12) {
    out.add(d.getUTCMonth() + 1);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return [...out];
}

export const ideaMatches = (idea: SeasonalIdea, months: number[]) => idea.months.some((m) => months.includes(m));

/**
 * The departure date to use when an idea is tapped: keep the chosen date if
 * it already falls in the idea's months, otherwise the 10th of the idea's
 * next best month (at least two weeks out).
 */
export function ideaDepartDate(idea: SeasonalIdea, current: string, today: string): string {
  const month = Number(current.slice(5, 7));
  if (idea.months.includes(month) && current >= today) return current;
  const t = new Date(today + "T00:00:00Z");
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + i, 10));
    const iso = d.toISOString().slice(0, 10);
    if (idea.months.includes(d.getUTCMonth() + 1) && Date.parse(iso) - t.getTime() >= 14 * 86400000) return iso;
  }
  return current;
}
