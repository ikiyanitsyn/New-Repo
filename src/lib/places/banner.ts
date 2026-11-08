import "server-only";
import { findCity } from "../cities";
import { commonsThumb } from "./links";
import { pageBanner } from "./parse";
import { articleTitle, articleUrl, raw } from "./wikivoyage";

/**
 * Just a city's wide banner photo (the travel guide's page banner on Wikimedia
 * Commons), without loading its hundreds of listings. Kept for a week.
 */
const TTL_MS = 7 * 24 * 3600_000;
const cache = new Map<string, { at: number; value: CityBanner }>();

export interface CityBanner {
  city: string;
  url: string | null;
  /** A full-size landscape photo for big heroes (the city's main Wikipedia photo when it suits). */
  hero: string | null;
  file: string | null;
  credit: string;
  creditUrl: string;
}

export async function cityBanner(code: string, width = 1920): Promise<CityBanner> {
  const key = `${code}|${width}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const city = findCity(code);
  const empty: CityBanner = { city: code, url: null, hero: null, file: null, credit: "", creditUrl: "" };
  if (!city) return empty;
  try {
    const page = await raw(articleTitle(code));
    const file = pageBanner(page.text) ?? null;
    const value: CityBanner = {
      city: code,
      url: file ? commonsThumb(file, width) : null,
      hero: await wikipediaHero(city.name, width),
      file,
      credit: file ? `Photo: Wikimedia Commons · ${page.title} on Wikivoyage` : "",
      creditUrl: file ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}` : articleUrl(page.title),
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return empty;
  }
}

/** The city's main Wikipedia photo, if it's a proper landscape shot (not a map, flag or collage strip). */
async function wikipediaHero(title: string, width: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query", prop: "pageimages", piprop: "thumbnail|original", pithumbsize: String(width),
      redirects: "1", format: "json", formatversion: "2", titles: title,
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "IntercontinentalNomad/0.3 (personal trip planner; https://github.com/ikiyanitsyn/New-Repo)" },
      signal: AbortSignal.timeout(8000),
    });
    const j = (await res.json()) as { query?: { pages?: { original?: { source: string; width: number; height: number }; thumbnail?: { source: string } }[] } };
    const page = j.query?.pages?.[0];
    const o = page?.original;
    if (!o || !page?.thumbnail || /\.svg$/i.test(o.source)) return null;
    const ratio = o.width / o.height;
    return o.width >= 1400 && ratio >= 1.2 && ratio <= 2.6 ? page.thumbnail.source : null;
  } catch {
    return null;
  }
}
