import "server-only";
import { getCity, type City } from "../cities";
import { distanceKm } from "../geo";
import { districtLinks, pageBanner, parseListings, redirectTarget } from "./parse";
import { commonsThumb } from "./links";
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

export const articleTitle = (cityCode: string) => {
  const city = getCity(cityCode);
  // `wikivoyageTitle` is being added to City separately; read it defensively.
  return TITLES[cityCode] ?? (city as { wikivoyageTitle?: string }).wikivoyageTitle ?? city.name;
};
export const articleUrl = (title: string) => `${BASE}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

/** Wikimedia answers 429 when busy: wait a moment and try again, three times at most. */
async function politeFetch(url: string, timeoutMs: number): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 429 || attempt >= 3) return res;
    const wait = Number(res.headers.get("retry-after")) * 1000 || 1500 * (attempt + 1);
    await new Promise((r) => setTimeout(r, Math.min(wait, 5000)));
  }
}

export async function raw(title: string, depth = 0): Promise<{ title: string; text: string }> {
  const res = await politeFetch(`${BASE}/w/index.php?title=${encodeURIComponent(title)}&action=raw`, 12000);
  if (!res.ok) throw new Error(`Wikivoyage responded ${res.status} for ${title}`);
  const text = await res.text();
  const target = redirectTarget(text);
  if (target && depth < 2) return raw(target, depth + 1);
  return { title, text };
}

/**
 * Photos for listings that name a Wikipedia article: one batched request to
 * Wikipedia's page-images API (up to 50 titles per call).
 */
async function wikipediaThumbs(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({
      action: "query", prop: "pageimages", piprop: "thumbnail", pithumbsize: "640",
      redirects: "1", format: "json", formatversion: "2", titles: batch.join("|"),
    });
    try {
      const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const j = (await res.json()) as {
        query?: { pages?: { title: string; thumbnail?: { source: string } }[]; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] };
      };
      const pages = new Map((j.query?.pages ?? []).filter((p) => p.thumbnail).map((p) => [p.title, p.thumbnail!.source]));
      const alias = new Map<string, string>();
      for (const r of [...(j.query?.normalized ?? []), ...(j.query?.redirects ?? [])]) alias.set(r.from, r.to);
      for (const t of batch) {
        let k = t;
        for (let n = 0; n < 3 && alias.has(k); n++) k = alias.get(k)!;
        const src = pages.get(k);
        if (src) out.set(t, src);
      }
    } catch {
      // Photos are a nice-to-have; carry on without them.
    }
  }
  return out;
}

const MAX_PER_CATEGORY = 40;
const MAX_KM_FROM_CENTRE = 90;

/** Broad articles (a state, a county, a whole country) list towns, not places to go. */
const BROAD = /( County| Region| Province|\(region\)| Wilderness Area)$/i;

/**
 * Guide articles around a searched place, nearest first: the place's own article if it has one
 * (Yosemite National Park), then nearby towns and parks (Oakhurst, Fish Camp, Bass Lake…).
 * Uses Wikivoyage's coordinate search; one request.
 */
export async function nearbyArticles(city: City, radiusKm = 60, max = 6): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: `nearcoord:${radiusKm}km,${city.lat},${city.lon}`, gsrlimit: "20",
    prop: "coordinates", format: "json", formatversion: "2",
  });
  const res = await politeFetch(`${BASE}/w/api.php?${params}`, 10000);
  if (!res.ok) throw new Error(`Wikivoyage responded ${res.status}`);
  const j = (await res.json()) as { query?: { pages?: { title: string; coordinates?: { lat: number; lon: number }[] }[] } };
  const skip = new Set([city.area, city.countryName, "United States", "United States of America"].filter(Boolean).map((t) => t!.toLowerCase()));
  const pages = (j.query?.pages ?? [])
    .filter((p) => p.coordinates?.[0] && !skip.has(p.title.toLowerCase()) && !BROAD.test(p.title) && !p.title.includes("/"))
    .map((p) => ({ title: p.title, km: distanceKm(city, p.coordinates![0]), own: p.title.toLowerCase() === city.name.toLowerCase() }))
    .filter((p) => p.km <= radiusKm + 10)
    .sort((a, b) => Number(b.own) - Number(a.own) || a.km - b.km);
  return pages.slice(0, max).map((p) => p.title);
}

/** A searched place: listings gathered from the nearest guide articles, each labelled with its article. */
async function placesAround(city: City): Promise<{ title: string; text: string; places: Place[] }> {
  const titles = await nearbyArticles(city);
  // The place may have its own article that the coordinate search missed (big parks have one point).
  const own = await raw(city.name).catch(() => null);
  const pages = own && !titles.includes(own.title) ? [own] : [];
  // One at a time: Wikimedia limits bursts, and these are cached for a day afterwards.
  for (const t of titles) {
    const page = await raw(t).catch(() => null);
    if (page) pages.push(page);
  }
  if (!pages.length) throw new Error("no nearby guide articles");
  const places = pages.flatMap((pg, i) => parseListings(pg.text, { district: pg.title === city.name ? undefined : pg.title, idPrefix: `n${i}` }));
  const main = pages.find((pg) => pageBanner(pg.text)) ?? pages[0];
  return { title: main.title, text: main.text, places };
}

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
    let main: { title: string; text: string };
    let places: Place[];
    if (city.custom) {
      const around = await placesAround(city);
      main = { title: around.title, text: around.text };
      places = around.places;
    } else {
      main = await raw(wanted);
      places = parseListings(main.text, { idPrefix: "m" });
    }

    if (!city.custom && places.filter((p) => p.lat !== undefined).length < 25) {
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

    const thumbs = await wikipediaThumbs([...new Set(trimmed.filter((p) => p.wikipedia && !p.image).map((p) => p.wikipedia!))]);
    for (const p of trimmed) {
      if (p.image) p.thumb = commonsThumb(p.image, 640);
      else if (p.wikipedia && thumbs.has(p.wikipedia)) p.thumb = thumbs.get(p.wikipedia);
    }
    const banner = pageBanner(main.text);

    const value: PlacesResult = {
      ...base,
      articleTitle: main.title,
      articleUrl: articleUrl(main.title),
      banner: banner ? commonsThumb(banner, 1600) : undefined,
      places: trimmed,
    };
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
