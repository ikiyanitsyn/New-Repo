import { getCity } from "./cities";
import { airlineName } from "./flights/airlines";
import { fmtTime } from "./format";
import { formatDuration, formatUsd } from "./geo";
import { estimateLeg, type Mode } from "./ground";
import { officialLinks } from "./ai/official";
import type { PlanItem, PlanResponse } from "./ai/schema";
import { CATEGORY_LABEL, CATEGORY_ORDER, type PlaceCategory } from "./places/types";
import { addDays, stopsWithDates, tripLegs, tripNights, type Leg, type Trip } from "./trip";

/**
 * The printable itinerary as plain data. Everything the document shows is
 * worked out here, so the page only lays it out and the CSV export uses the
 * same rows. Pure: no browser APIs, no dates from the clock.
 */

export interface DocTransport {
  legId: string;
  kind: "flight" | "ground";
  mode: Mode;
  date: string;
  from: string; // city code
  to: string;
  fromName: string;
  toName: string;
  /** Airline names for a chosen flight, or the rail service for a known train. */
  carrier?: string;
  /** "13:05" local departure for a chosen flight. */
  departTime?: string;
  durationMin: number;
  stops?: number;
  /** USD for the whole party. Null when a flight has not been chosen yet. */
  costUsd: number | null;
  costKind: "chosen" | "estimate" | "none";
  priceBasis?: "per person" | "per vehicle";
  notes: string[];
  bookingUrl?: string;
}

export interface DocDay {
  date: string;
  dayNumber: number;
  weekday: string; // "THU", like the owner's spreadsheet
  cityCode: string;
  cityName: string;
  localName?: string;
  /** travel: in the air before the first stop; arrive/transfer: first day in a city; depart: last day of the trip. */
  kind: "travel" | "arrive" | "stay" | "transfer" | "depart";
  stopId: string;
  lodging: string[];
  transport: DocTransport[];
  title?: string;
  highlights: string[];
  items: PlanItem[];
  /** Transport cost known for this day (chosen flights plus ground estimates). */
  costUsd: number;
}

export interface DocPlaceGroup {
  category: PlaceCategory;
  label: string;
  names: string[];
}

export interface DocCity {
  stopId: string;
  code: string;
  name: string;
  localName?: string;
  countryName: string;
  arrive: string;
  depart: string;
  nights: number;
  lodging: string[];
  places: DocPlaceGroup[];
  days: DocDay[];
}

export interface ItineraryDoc {
  title: string;
  startDate: string;
  endDate: string;
  nights: number;
  dayCount: number;
  travellers: number;
  cabin: string;
  homeName: string;
  /** City codes in travel order, starting (and, for a round trip, ending) at home. */
  route: string[];
  routeLine: string;
  cityNames: string[];
  days: DocDay[];
  cities: DocCity[];
  transport: DocTransport[];
  totals: { flights: number; ground: number; total: number; unpricedFlights: number };
  plan: { present: boolean; outdated: boolean; source?: "gemini" | "sample"; title?: string; summary?: string };
  beforeYouGo: PlanResponse["beforeYouGo"];
  official: { country: string; links: { label: string; url: string }[] }[];
}

const CABIN_LABEL: Record<string, string> = { economy: "Economy", premium: "Premium economy", business: "Business", first: "First" };

/** Same signature the Concierge stores with a plan, to tell whether the route changed since. */
export const stopSignature = (t: Trip) => t.stops.map((s) => `${s.city}:${s.nights}`).join(",") + `|${t.departDate}`;

export function weekday(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase();
}

function legTransport(trip: Trip, leg: Leg): DocTransport {
  const base = {
    legId: leg.id, mode: leg.mode, date: leg.date,
    from: leg.from.code, to: leg.to.code, fromName: leg.from.name, toName: leg.to.name,
  };
  if (leg.mode === "flight") {
    const pick = trip.picks?.[leg.id];
    // A pick made for another date is stale (the planner ignores it too).
    if (pick && pick.date === leg.date) {
      return {
        ...base, kind: "flight",
        carrier: pick.airlines.map(airlineName).join(" · ") || undefined,
        departTime: fmtTime(pick.departLocal) || undefined,
        durationMin: pick.durationMin,
        stops: pick.stops,
        costUsd: pick.priceTotal,
        costKind: "chosen",
        notes: [],
        bookingUrl: pick.bookingUrl,
      };
    }
    const est = estimateLeg(leg.from, leg.to, "flight");
    return { ...base, kind: "flight", durationMin: est.durationMin, costUsd: null, costKind: "none", notes: ["Flight not chosen yet"] };
  }
  const est = estimateLeg(leg.from, leg.to, leg.mode);
  const [service, ...rest] = est.notes;
  const knownService = est.source === "typical";
  return {
    ...base, kind: "ground",
    carrier: knownService ? service : undefined,
    durationMin: est.durationMin,
    costUsd: est.priceBasis === "per person" ? est.priceUsd * trip.adults : est.priceUsd,
    costKind: "estimate",
    priceBasis: est.priceBasis,
    notes: knownService ? rest : est.notes,
  };
}

/** One-line summary of a transport leg, for table cells and the CSV. */
export function transportLine(t: DocTransport): string {
  const route = `${t.from} → ${t.to}`;
  const mode = t.mode[0].toUpperCase() + t.mode.slice(1);
  const parts: string[] = [`${mode} ${route}`];
  if (t.carrier) parts.push(t.carrier);
  if (t.departTime) parts.push(`dep ${t.departTime}`);
  parts.push(formatDuration(t.durationMin));
  if (t.kind === "flight" && t.stops !== undefined && t.costKind === "chosen") parts.push(t.stops === 0 ? "nonstop" : `${t.stops} stop${t.stops > 1 ? "s" : ""}`);
  if (t.costKind === "chosen" && t.costUsd !== null) parts.push(formatUsd(t.costUsd));
  else if (t.costKind === "estimate" && t.costUsd !== null) parts.push(`~${formatUsd(t.costUsd)}`);
  else parts.push("not chosen");
  return parts.join(" · ");
}

export function buildItinerary(trip: Trip): ItineraryDoc | null {
  const stops = stopsWithDates(trip);
  if (stops.length === 0) return null;
  const home = getCity(trip.home);
  const legs = tripLegs(trip);
  const transport = legs.map((l) => legTransport(trip, l));
  const last = stops[stops.length - 1];
  const endDate = last.depart;

  const plan = trip.plan;
  const planDays = plan?.response.days ?? [];
  const planFor = (date: string, city: string) => planDays.find((d) => d.date === date && d.city === city);

  const savedIn = (code: string) => trip.saved?.[code] ?? [];
  const lodgingIn = (code: string) => savedIn(code).filter((p) => p.category === "sleep").map((p) => p.name);

  // One row per calendar day, from leaving home to the last departure.
  const days: DocDay[] = [];
  let n = 0;
  for (let date = trip.departDate; date <= endDate; date = addDays(date, 1)) {
    n++;
    const idx = stops.findIndex((s) => s.arrive <= date && date < s.depart);
    const stop = idx >= 0 ? stops[idx] : date < stops[0].arrive ? stops[0] : last;
    let kind: DocDay["kind"];
    if (date < stops[0].arrive) kind = "travel";
    else if (idx < 0) kind = "depart";
    else if (date === stop.arrive) kind = idx === 0 ? "arrive" : "transfer";
    else kind = "stay";
    const dayTransport = transport.filter((t) => t.date === date);
    const p = kind === "travel" ? undefined : planFor(date, stop.city);
    const items = p?.items ?? [];
    const cost = dayTransport.reduce((s, t) => s + (t.costUsd ?? 0), 0);
    days.push({
      date,
      dayNumber: n,
      weekday: weekday(date),
      cityCode: kind === "travel" ? home.code : stop.city,
      cityName: kind === "travel" ? `${home.name} → ${stop.cityInfo.name}` : stop.cityInfo.name,
      localName: kind === "travel" ? undefined : stop.cityInfo.localName,
      kind,
      stopId: stop.id,
      // You sleep in a city on every night of its stay; nowhere on the last day or in the air.
      lodging: kind === "travel" || kind === "depart" ? [] : lodgingIn(stop.city),
      transport: dayTransport,
      title: p?.title,
      highlights: items.filter((i) => i.kind !== "travel").map((i) => i.title),
      items,
      costUsd: cost,
    });
  }

  const cities: DocCity[] = stops.map((s) => {
    const places = CATEGORY_ORDER.map((category) => ({
      category,
      label: CATEGORY_LABEL[category],
      names: savedIn(s.city).filter((p) => p.category === category).map((p) => p.name),
    })).filter((g) => g.names.length > 0);
    return {
      stopId: s.id,
      code: s.city,
      name: s.cityInfo.name,
      localName: s.cityInfo.localName,
      countryName: s.cityInfo.countryName,
      arrive: s.arrive,
      depart: s.depart,
      nights: s.nights,
      lodging: lodgingIn(s.city),
      places,
      days: days.filter((d) => d.stopId === s.id),
    };
  });

  let flights = 0, ground = 0, unpricedFlights = 0;
  for (const t of transport) {
    if (t.kind === "flight") {
      if (t.costUsd === null) unpricedFlights++;
      else flights += t.costUsd;
    } else ground += t.costUsd ?? 0;
  }

  const route = [trip.home, ...stops.map((s) => s.city), ...(trip.returnHome ? [trip.home] : [])];
  const official = plan?.official?.length ? plan.official : officialLinks(stops.map((s) => s.city));

  return {
    title: trip.title.trim() || "My trip",
    startDate: trip.departDate,
    endDate,
    nights: tripNights(trip),
    dayCount: days.length,
    travellers: trip.adults,
    cabin: CABIN_LABEL[trip.cabin] ?? trip.cabin,
    homeName: home.name,
    route,
    routeLine: route.join(" → "),
    cityNames: stops.map((s) => s.cityInfo.name).filter((c, i, a) => a.indexOf(c) === i),
    days,
    cities,
    transport,
    totals: { flights, ground, total: flights + ground, unpricedFlights },
    plan: {
      present: !!plan && planDays.length > 0,
      outdated: !!plan && plan.forStops !== stopSignature(trip),
      source: plan?.source,
      title: plan?.response.title,
      summary: plan?.response.summary,
    },
    beforeYouGo: plan?.response.beforeYouGo ?? [],
    official,
  };
}

// ---------- At-a-glance rows and CSV ----------

export const GLANCE_HEADERS = ["Date", "Day", "Weekday", "City", "Lodging", "Transport", "Plan highlights", "Cost (USD)"] as const;

export function glanceRows(doc: ItineraryDoc): string[][] {
  return doc.days.map((d) => [
    d.date,
    String(d.dayNumber),
    d.weekday,
    d.cityName,
    d.lodging.join("; ") || "—",
    d.transport.map(transportLine).join("; ") || "—",
    [d.title, ...d.highlights].filter(Boolean).join("; ") || "—",
    d.costUsd ? String(d.costUsd) : "",
  ]);
}

/**
 * Quote a CSV cell. Cells that a spreadsheet would read as a formula get a
 * leading apostrophe, since plan text comes from an AI and could be anything.
 */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function itineraryCsv(doc: ItineraryDoc): string {
  const rows: string[][] = [[...GLANCE_HEADERS], ...glanceRows(doc)];
  rows.push(["", "", "", "", "", "", "Transport total", String(doc.totals.total)]);
  // Byte-order mark so Excel opens the UTF-8 (Chinese city names) correctly.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function csvFileName(doc: ItineraryDoc): string {
  const slug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "itinerary";
  return `${slug}-${doc.startDate}.csv`;
}
