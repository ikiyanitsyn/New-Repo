import "server-only";
import { getCity, type City } from "../cities";
import { matchCandidate, normalizeName } from "./match";
import { cityPlaces } from "./wikivoyage";
import type { Place, PlaceRating, PlaceReview, RatingsProviderInfo, RatingsResult } from "./types";

/**
 * Ratings and short reviews for guide listings, from an outside provider.
 *
 * Provider: Google Places API (New), Text Search. One call per place returns
 * the rating, rating count, price level, Maps link and up to five reviews.
 * That field set is billed as "Text Search Enterprise + Atmosphere", which has
 * a free allowance of 1,000 calls a month (needs a Google Cloud billing
 * account; see docs/SETUP_GUIDE.md).
 *
 * To make the allowance last:
 *  - places are looked up only when the traveller views them (the browser asks
 *    for the visible category or the opened place, never the whole city);
 *  - at most MAX_LOOKUPS_PER_REQUEST new lookups per request;
 *  - a daily safety stop (GOOGLE_PLACES_DAILY_LIMIT, default 30, about 900 a month);
 *  - answers, including "no match", are remembered in memory, and the route
 *    lets the CDN keep responses.
 *
 * Without GOOGLE_PLACES_API_KEY the provider is off and the guide simply shows
 * no ratings.
 */

export interface RatingsProvider {
  info: RatingsProviderInfo;
  lookup(place: Place, city: City): Promise<PlaceRating | null>;
}

// ---------- Google Places API (New) ----------

const GOOGLE_URL = "https://places.googleapis.com/v1/places:searchText";

/** Only these fields are requested; the field list decides the price tier. */
export const GOOGLE_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.googleMapsUri",
  "places.reviews",
].join(",");

export interface GooglePlace {
  id: string;
  displayName?: { text: string; languageCode?: string };
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
  reviews?: {
    name?: string;
    relativePublishTimeDescription?: string;
    rating?: number;
    text?: { text: string; languageCode?: string };
    originalText?: { text: string; languageCode?: string };
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
    publishTime?: string;
  }[];
}

const PRICE_LEVEL: Record<string, PlaceRating["priceLevel"]> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export const MAX_REVIEWS = 3;

/** A Google place, in the app's own shape. */
export function mapGooglePlace(g: GooglePlace): PlaceRating {
  const reviews: PlaceReview[] = [];
  for (const r of g.reviews ?? []) {
    const text = (r.text?.text ?? r.originalText?.text ?? "").trim();
    if (!text) continue;
    reviews.push({
      author: r.authorAttribution?.displayName?.trim() || "Google user",
      authorUrl: r.authorAttribution?.uri,
      rating: r.rating,
      when: r.relativePublishTimeDescription,
      publishTime: r.publishTime,
      text,
    });
    if (reviews.length >= MAX_REVIEWS) break;
  }
  return {
    rating: typeof g.rating === "number" ? Math.round(g.rating * 10) / 10 : undefined,
    count: g.userRatingCount,
    priceLevel: g.priceLevel ? PRICE_LEVEL[g.priceLevel] : undefined,
    url: g.googleMapsUri,
    reviews,
  };
}

/** The Text Search result that is the same place as the guide listing, if any. */
export function pickGoogleMatch(place: Place, places: GooglePlace[], city: City): GooglePlace | undefined {
  const candidates = places
    .filter((g) => g.displayName?.text)
    .map((g) => ({ name: g.displayName!.text, lat: g.location?.latitude, lon: g.location?.longitude, g }));
  return matchCandidate(place, candidates, { cityCentre: city, ignore: [city.name, city.localName ?? ""] })?.g;
}

export function googleProvider(key: string): RatingsProvider {
  return {
    info: { id: "google", name: "Google Maps", showOnMap: false },
    async lookup(place, city) {
      const hasPin = place.lat !== undefined && place.lon !== undefined;
      const res = await fetch(GOOGLE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": GOOGLE_FIELD_MASK },
        body: JSON.stringify({
          textQuery: `${place.name}, ${city.name}`,
          languageCode: "en",
          pageSize: 5,
          locationBias: {
            circle: {
              center: hasPin ? { latitude: place.lat, longitude: place.lon } : { latitude: city.lat, longitude: city.lon },
              radius: hasPin ? 500 : 30000,
            },
          },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Google Places responded ${res.status}`);
      const j = (await res.json()) as { places?: GooglePlace[] };
      const hit = pickGoogleMatch(place, j.places ?? [], city);
      return hit ? mapGooglePlace(hit) : null;
    },
  };
}

// ---------- Choosing a provider, caching and limits ----------

/** The configured provider, or null when no key is set. */
export function ratingsProvider(env: Record<string, string | undefined> = process.env): RatingsProvider | null {
  const key = env.GOOGLE_PLACES_API_KEY?.trim();
  return key ? googleProvider(key) : null;
}

export const MAX_IDS_PER_REQUEST = 24;
export const MAX_LOOKUPS_PER_REQUEST = 12;
const PARALLEL = 4;

const dailyLimit = () => Math.max(0, Number(process.env.GOOGLE_PLACES_DAILY_LIMIT ?? 30) || 0);
const cacheMs = () => Math.max(1, Number(process.env.RATINGS_CACHE_HOURS ?? 24) || 24) * 3600_000;

const cache = new Map<string, { at: number; value: PlaceRating | null }>();
const inflight = new Map<string, Promise<PlaceRating | null>>();
let usage = { day: "", used: 0 };

/** For tests. */
export function resetRatingsState() {
  cache.clear();
  inflight.clear();
  usage = { day: "", used: 0 };
}

const ratingKey = (providerId: string, cityCode: string, place: Place) =>
  `${providerId}:${cityCode}:${normalizeName(place.name)}:${place.lat?.toFixed(3) ?? ""}`;

/**
 * Ratings already remembered in memory (by guide place id). Never calls the provider and never
 * spends quota: places that were not looked up yet are simply left out. Used by the planner.
 */
export function cachedRatings(cityCode: string, places: Place[], providerId = "google"): Record<string, PlaceRating> {
  const out: Record<string, PlaceRating> = {};
  const now = Date.now();
  for (const place of places) {
    const hit = cache.get(ratingKey(providerId, cityCode, place));
    if (hit?.value && hit.value.rating !== undefined && now - hit.at < cacheMs()) out[place.id] = hit.value;
  }
  return out;
}

function takeBudget(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (usage.day !== day) usage = { day, used: 0 };
  if (usage.used >= dailyLimit()) return false;
  usage.used++;
  return true;
}

/**
 * Ratings for some of a city's guide listings (by guide place id).
 * Places already known come from memory; at most MAX_LOOKUPS_PER_REQUEST are
 * looked up. Ids that were skipped (limits, errors) are left out of the
 * result, so the page can simply show no rating for them.
 */
export async function placeRatings(cityCode: string, ids: string[], provider: RatingsProvider | null = ratingsProvider()): Promise<RatingsResult> {
  if (!provider) return { provider: null, ratings: {} };
  const city = getCity(cityCode);
  const guide = await cityPlaces(cityCode);
  const byId = new Map(guide.places.map((p) => [p.id, p]));
  const wanted = [...new Set(ids)].slice(0, MAX_IDS_PER_REQUEST).map((id) => byId.get(id)).filter((p): p is Place => !!p);

  const ratings: RatingsResult["ratings"] = {};
  const todo: { place: Place; key: string }[] = [];
  const now = Date.now();
  for (const place of wanted) {
    const key = ratingKey(provider.info.id, cityCode, place);
    const hit = cache.get(key);
    if (hit && now - hit.at < cacheMs()) ratings[place.id] = hit.value;
    else todo.push({ place, key });
  }

  let note: string | undefined;
  const queue = todo.slice(0, MAX_LOOKUPS_PER_REQUEST);
  if (todo.length > queue.length) note = "Some places will be rated as you scroll.";
  let failed = false;

  const work = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      if (failed) return;
      const { place, key } = item;
      let pending = inflight.get(key);
      if (!pending) {
        if (!takeBudget()) { note = "Ratings paused for today to stay within the free allowance."; return; }
        pending = provider.lookup(place, city);
        inflight.set(key, pending);
      }
      try {
        const value = await pending;
        cache.set(key, { at: Date.now(), value });
        ratings[place.id] = value;
      } catch {
        failed = true;
        note = "Ratings are unavailable right now.";
      } finally {
        inflight.delete(key);
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, work));
  return { provider: provider.info, ratings, ...(note ? { note } : {}) };
}
