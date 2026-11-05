import { flightCodeOf, getCity, type City } from "../cities";
import { distanceKm } from "../geo";
import type { Cabin, FlightOffer, FlightQuery } from "./types";

/**
 * Deterministic sample fares, used when no API key is configured.
 * Durations come from great-circle distance; prices are plausible
 * but invented. The UI labels every sample result as sample data.
 */

function rng(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CABIN_MULT: Record<Cabin, number> = { economy: 1, premium: 1.7, business: 3.8, first: 6 };

interface Carrier { name: string; hub: string; hubCity: City | null; regions: string[] }

const C = (name: string, hub: string, hubCode: string | null, regions: string[]): Carrier => ({
  name,
  hub,
  hubCity: hubCode ? getCity(hubCode) : null,
  regions,
});

const CARRIERS: Carrier[] = [
  C("Air China", "PEK", "BJS", ["East Asia", "North America", "Europe"]),
  C("China Eastern", "PVG", "SHA", ["East Asia", "North America", "Europe"]),
  C("China Southern", "CAN", "CAN", ["East Asia", "Southeast Asia", "North America"]),
  C("Cathay Pacific", "HKG", "HKG", ["East Asia", "Southeast Asia", "North America", "Europe"]),
  C("United", "SFO", "SFO", ["North America", "East Asia", "Europe"]),
  C("Delta", "SEA", "SEA", ["North America", "East Asia", "Europe"]),
  C("American", "CHI", "CHI", ["North America", "Europe", "East Asia"]),
  C("Korean Air", "ICN", "SEL", ["East Asia", "North America"]),
  C("ANA", "HND", "TYO", ["East Asia", "North America"]),
  C("Japan Airlines", "HND", "TYO", ["East Asia", "North America"]),
  C("Singapore Airlines", "SIN", "SIN", ["Southeast Asia", "East Asia", "North America", "Europe"]),
  C("Thai Airways", "BKK", "BKK", ["Southeast Asia", "East Asia", "Europe"]),
  C("Turkish Airlines", "IST", "IST", ["Europe", "East Asia", "North America", "Southeast Asia"]),
  C("British Airways", "LHR", "LON", ["Europe", "North America"]),
  C("Air France", "CDG", "PAR", ["Europe", "North America", "East Asia"]),
  C("KLM", "AMS", "AMS", ["Europe", "North America", "East Asia"]),
  C("ITA Airways", "FCO", "ROM", ["Europe", "North America"]),
  C("Iberia", "MAD", "MAD", ["Europe", "North America"]),
  C("Lufthansa", "MUC", "MUC", ["Europe", "North America", "East Asia"]),
  C("SWISS", "ZRH", "ZRH", ["Europe", "North America"]),
  C("Emirates", "DXB", "DXB", ["Middle East", "Europe", "East Asia", "Southeast Asia", "North America"]),
  C("EVA Air", "TPE", "TPE", ["East Asia", "Southeast Asia", "North America"]),
  C("Vietnam Airlines", "HAN", "HAN", ["Southeast Asia", "East Asia"]),
  C("Malaysia Airlines", "KUL", "KUL", ["Southeast Asia", "East Asia"]),
];

function addMinutes(isoLocal: string, min: number): string {
  // Treat the local timestamp as UTC purely for arithmetic.
  const t = new Date(isoLocal + ":00Z").getTime() + min * 60000;
  return new Date(t).toISOString().slice(0, 16);
}

export function sampleOffers(q: FlightQuery): FlightOffer[] {
  const from = getCity(q.from);
  const to = getCity(q.to);
  const rand = rng(`${q.from}-${q.to}-${q.date}-${q.cabin}`);
  const km = distanceKm(from, to);
  const cruise = (k: number) => 35 + (k / 830) * 60;
  const pool = CARRIERS.filter((c) => c.regions.includes(from.region) || c.regions.includes(to.region));
  const longHaul = km > 4000;

  const offers: FlightOffer[] = [];
  const count = 9 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    const carrier = pool[Math.floor(rand() * pool.length)];
    // Direct flights only when the carrier is based at one end (keeps it plausible).
    const basedAtEnd = carrier.hubCity && (carrier.hubCity.code === flightCodeOf(from) || carrier.hubCity.code === flightCodeOf(to));
    const stops = basedAtEnd && rand() < 0.75 ? 0 : rand() < 0.8 ? 1 : 2;

    let durationMin: number;
    const layovers: FlightOffer["layovers"] = [];
    const via = carrier.hubCity && !basedAtEnd ? carrier.hub : ["ICN", "IST", "DOH", "NRT", "FRA", "HKG"][Math.floor(rand() * 6)];
    if (stops === 0) {
      durationMin = cruise(km) + rand() * 25;
    } else {
      const detour = carrier.hubCity && !basedAtEnd ? distanceKm(from, carrier.hubCity) + distanceKm(carrier.hubCity, to) : km * (1.08 + rand() * 0.15);
      const lay1 = 70 + rand() * 300;
      layovers.push({ airport: via, durationMin: Math.round(lay1) });
      durationMin = cruise(detour) + 30 + lay1;
      if (stops === 2) {
        const lay2 = 60 + rand() * 180;
        layovers.push({ airport: ["PEK", "PVG", "CAN", "AMS", "LHR"][Math.floor(rand() * 5)], durationMin: Math.round(lay2) });
        durationMin += lay2 + 50;
      }
    }

    const base = (longHaul ? 0.085 : 0.13) * km + 60;
    let pp = base * (0.75 + rand() * 0.7);
    if (stops === 0) pp *= 1.18;
    if (stops === 2) pp *= 0.88;
    pp *= CABIN_MULT[q.cabin];
    pp = Math.round(pp / 5) * 5 - 1;

    const depHour = 6 + Math.floor(rand() * 17);
    const depMin = [0, 10, 25, 35, 45, 55][Math.floor(rand() * 6)];
    const departLocal = `${q.date}T${String(depHour).padStart(2, "0")}:${String(depMin).padStart(2, "0")}`;
    durationMin = Math.round(durationMin);

    offers.push({
      id: `sample-${i}`,
      source: "sample",
      priceTotal: pp * q.adults,
      pricePerPerson: pp,
      airlines: [carrier.name],
      departLocal,
      // Arrival shown in departure-clock time would mislead across zones, so leave it to duration.
      arriveLocal: undefined,
      durationMin,
      stops,
      layovers,
      segments: [
        {
          from: from.airports[0],
          to: stops === 0 ? to.airports[0] : layovers[0].airport,
          departLocal,
          airline: carrier.name,
        },
        ...(stops > 0
          ? [{ from: layovers[0].airport, to: to.airports[0], departLocal: addMinutes(departLocal, durationMin - 300), airline: carrier.name }]
          : []),
      ],
    });
  }
  // Deduplicate near-identical offers.
  const seen = new Set<string>();
  return offers.filter((o) => {
    const k = `${o.airlines[0]}-${o.stops}-${o.departLocal}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
