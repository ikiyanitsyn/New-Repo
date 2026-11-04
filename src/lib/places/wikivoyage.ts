import "server-only";
import { getCity } from "../cities";
import { distanceKm } from "../geo";
import { districtLinks, parseListings, redirectTarget } from "./parse";
import { CATEGORY_ORDER, type Place, type PlacesResult } from "./types";

/**
 * Wikivoyage: the free, editable travel guide (text CC BY-SA). No key needed.
 * Large cities keep their listings in district articles ("Beijing/Dongcheng"),
 * so when the main article has few mapped listings we read its districts too.
 */

const BASE = "https://en.wikivoyage.org";
const HEADERS = {
  // Wikimedia asks API clients to identify themselves.
  "User-Agent": "IntercontinentalNomad/0.2 (personal trip planner; https://github.com/ikiyanitsyn/New-Repo)",
};
const TTL_MS = 24 * 3600_000;
const cache = new Map<string, { at: number; value: PlacesResult }>();

/** Wikivoyage article titles, where they differ from the city name. */
const TITLES: Record<string, string> = {};

export const articleTitle = (cityCode: string) => TITLES[cityCode] ?? getCity(cityCode).name;
export const articleUrl = (title: string) => `${BASE}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

async function raw(title: string, depth = 0): Promise<{ title: string; text: string }> {
  const res = await fetch(`${BASE}/w/index.php?title=${encodeURIComponent(title)}&action=raw`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Wikivoyage responded ${res.status} for ${title}`);
  const text = await res.text();
  const target = redirectTarget(text);
  if (target && depth < 2) return raw(target, depth + 1);
  return { title, text };
}

const MAX_PER_CATEGORY = 40;
const MAX_KM_FROM_CENTRE = 90;

export async function cityPlaces(cityCode: string): Promise<PlacesResult> {
  const hit = cache.get(cityCode);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const city = getCity(cityCode);
  const wanted = articleTitle(cityCode);
  const base: Omit<PlacesResult, "places"> = {
    city: cityCode,
    source: "wikivoyage",
    articleTitle: wanted,
    articleUrl: articleUrl(wanted),
    fetchedAt: new Date().toISOString(),
  };

  try {
    const main = await raw(wanted);
    let places = parseListings(main.text, { idPrefix: "m" });

    if (places.filter((p) => p.lat !== undefined).length < 25) {
      const districts = districtLinks(main.text, main.title);
      const pages = await Promise.allSettled(districts.map((t) => raw(t)));
      pages.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const district = districts[i].split("/").slice(1).join("/");
        places = places.concat(parseListings(r.value.text, { district, idPrefix: `d${i}` }));
      });
    }

    // Drop coordinates that land far outside the city (typos, day trips).
    for (const p of places) {
      if (p.lat !== undefined && p.lon !== undefined && distanceKm(city, { lat: p.lat, lon: p.lon }) > MAX_KM_FROM_CENTRE) {
        p.lat = p.lon = undefined;
      }
    }

    // Keep each category to a readable size, preferring listings that can be mapped.
    const trimmed: Place[] = [];
    for (const cat of CATEGORY_ORDER) {
      const inCat = places.filter((p) => p.category === cat);
      const mapped = inCat.filter((p) => p.lat !== undefined);
      const unmapped = inCat.filter((p) => p.lat === undefined);
      trimmed.push(...[...mapped, ...unmapped].slice(0, MAX_PER_CATEGORY));
    }

    const value: PlacesResult = { ...base, articleTitle: main.title, articleUrl: articleUrl(main.title), places: trimmed };
    cache.set(cityCode, { at: Date.now(), value });
    return value;
  } catch (err) {
    return {
      ...base,
      places: [],
      error: err instanceof Error ? `Couldn't load the city guide (${err.message}).` : "Couldn't load the city guide.",
    };
  }
}
