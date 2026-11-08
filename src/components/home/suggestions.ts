import { findCity } from "@/lib/cities";
import { searchStops, type TripSearch } from "@/lib/newTrip";
import { programmesFor } from "@/lib/stopovers";
import { addDaysIso } from "./rangeCalendar";

/*
 * Gentle suggestion cards on the home page, reacting to the search.
 *
 * ONE FILE TO TUNE. Each rule looks at the search and returns a card or
 * nothing. Rules are tried in order and at most MAX_VISIBLE show at once, so
 * put the most useful first. To change the wording, edit `text`; to switch a
 * rule off, delete it or add `off: true`. Keep them short, kind and factual:
 * they are hints, not ads.
 */

export const MAX_VISIBLE = 2;

export type SuggestionAction =
  | { kind: "addCity"; city: string; nights: number; label: string }
  | { kind: "stopover"; programme: string; label: string }
  | { kind: "link"; href: string; label: string };

export interface Suggestion {
  id: string;
  text: string;
  action?: SuggestionAction;
}

export interface Rule {
  id: string;
  off?: boolean;
  run: (ctx: SuggestionContext) => Omit<Suggestion, "id"> | null;
}

/** What the rules can see: the search, plus a few derived facts. */
export interface SuggestionContext {
  search: TripSearch;
  /** Catalog codes of every city in the search, in order. */
  cities: string[];
  /** Last day of the trip (return date, or departure + nights). */
  end: string;
}

export function contextFor(search: TripSearch): SuggestionContext {
  const stops = searchStops(search);
  const total = stops.reduce((n, s) => n + s.nights, 0);
  return {
    search,
    cities: stops.map((s) => s.city),
    end: search.returnDate && search.tripType !== "multi" && search.tripType !== "oneway" ? search.returnDate : addDaysIso(search.departDate, total + 1),
  };
}

const has = (ctx: SuggestionContext, code: string) => ctx.cities.includes(code);
const inCountry = (ctx: SuggestionContext, country: string) => ctx.cities.some((c) => findCity(c)?.country === country);
const canAdd = (ctx: SuggestionContext) => ctx.search.tripType === "multi" || ctx.search.tripType === "round" || ctx.search.tripType === "oneway";

/** True when [start, end] touches any day from `from` to `to` (MM-DD), in any year of the trip. */
function overlaps(ctx: SuggestionContext, from: string, to: string): boolean {
  const a = ctx.search.departDate;
  const b = ctx.end;
  for (let y = Number(a.slice(0, 4)); y <= Number(b.slice(0, 4)); y++) {
    if (a <= `${y}-${to}` && b >= `${y}-${from}`) return true;
  }
  return false;
}

// Spring Festival (Chinese New Year's Day); the busy travel weeks run about a week either side.
const SPRING_FESTIVAL: Record<number, string> = { 2027: "02-06", 2028: "01-26", 2029: "02-13", 2030: "02-03" };

export const RULES: Rule[] = [
  {
    id: "golden-week",
    run: (ctx) =>
      inCountry(ctx, "CN") && overlaps(ctx, "10-01", "10-07")
        ? { text: "Oct 1–7 is China's Golden Week: trains, hotels and sights are at their busiest. A week either side is calmer." }
        : null,
  },
  {
    id: "spring-festival",
    run: (ctx) => {
      if (!inCountry(ctx, "CN") && !has(ctx, "HKG") && !has(ctx, "TPE")) return null;
      const y = Number(ctx.search.departDate.slice(0, 4));
      for (const year of [y, y + 1]) {
        const day = SPRING_FESTIVAL[year];
        if (!day) continue;
        const from = addDaysIso(`${year}-${day}`, -7).slice(5);
        const to = addDaysIso(`${year}-${day}`, 7).slice(5);
        if (overlaps(ctx, from, to)) return { text: "Your dates fall around Chinese New Year: festive, but transport sells out early and some shops close for days." };
      }
      return null;
    },
  },
  {
    id: "sakura-kyoto",
    run: (ctx) => {
      const m = Number(ctx.search.departDate.slice(5, 7));
      if (!(m === 3 || m === 4) || !canAdd(ctx) || has(ctx, "UKY")) return null;
      if (!has(ctx, "TYO") && !has(ctx, "OSA")) return null;
      return { text: "Late March to mid April is cherry-blossom season. Add Kyoto?", action: { kind: "addCity", city: "UKY", nights: 3, label: "Add Kyoto" } };
    },
  },
  {
    id: "hk-macau",
    run: (ctx) =>
      has(ctx, "HKG") && !has(ctx, "MFM") && canAdd(ctx)
        ? { text: "Hong Kong ⇄ Macau is about an hour by ferry. Add Macau?", action: { kind: "addCity", city: "MFM", nights: 2, label: "Add Macau" } }
        : null,
  },
  {
    id: "china-transit",
    run: (ctx) => {
      // A route that leaves mainland China for a third country or region (Hong Kong counts)
      // may qualify for 240-hour visa-free transit. Only hint when the mainland part is short.
      const stops = searchStops(ctx.search);
      const mainland = stops.filter((s) => findCity(s.city)?.country === "CN");
      const last = stops[stops.length - 1];
      if (!mainland.length || !last || findCity(last.city)?.country === "CN") return null;
      if (mainland.reduce((n, s) => n + s.nights, 0) > 9) return null;
      return { text: "Ending outside the mainland may let a US passport use China's 240-hour visa-free transit.", action: { kind: "link", href: "#stopovers", label: "Check the terms" } };
    },
  },
  {
    id: "stopover-programme",
    run: (ctx) => {
      if (ctx.search.tripType === "stopover") return null;
      const dest = ctx.cities[0];
      if (!dest) return null;
      const p = programmesFor(ctx.search.home, dest).find((x) => x.hubCity && !has(ctx, x.hubCity) && x.id !== "china-transit");
      if (!p) return null;
      return { text: `${p.airline} offers a ${p.hubName} stopover on routes like this.`, action: { kind: "stopover", programme: p.id, label: "Plan with it" } };
    },
  },
  {
    id: "japan-rainy",
    run: (ctx) => (inCountry(ctx, "JP") && Number(ctx.search.departDate.slice(5, 7)) === 6 ? { text: "June is the rainy season in most of Japan. Pack an umbrella, or consider Sapporo." } : null),
  },
];

/** The cards to show: rules in order, skipping dismissed ones, at most MAX_VISIBLE. */
export function suggestionsFor(search: TripSearch, dismissed: string[] = [], rules: Rule[] = RULES): Suggestion[] {
  const ctx = contextFor(search);
  const out: Suggestion[] = [];
  for (const r of rules) {
    if (r.off || dismissed.includes(r.id)) continue;
    const s = r.run(ctx);
    if (s) out.push({ id: r.id, ...s });
    if (out.length >= MAX_VISIBLE) break;
  }
  return out;
}
