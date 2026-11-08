import "server-only";
import { findCity } from "../cities";
import { consumeSerpapi, refundSerpapi, serpapiQuota } from "../serpapiQuota";
import { serpapiHotels } from "./serpapi";
import type { HotelsErrorCode, HotelsQuery, HotelsResult, HotelsStatus } from "./types";

/**
 * Live hotel prices with a 12 hour in-memory cache and the shared SerpApi
 * monthly safety counter (src/lib/serpapiQuota.ts).
 *
 * Quota policy: one search per button press ("Show live prices"), never
 * automatic. A cached answer costs nothing, and the browser also keeps the
 * answer it got for 12 hours, so reopening a city never spends a search.
 */

export const HOTELS_CACHE_MS = 12 * 3600_000;

const cache = new Map<string, { at: number; value: HotelsResult }>();

export class HotelsError extends Error {
  constructor(public code: HotelsErrorCode, message: string, public status: number) {
    super(message);
  }
}

export const hotelsStatus = (): HotelsStatus => ({ available: Boolean(process.env.SERPAPI_KEY), quota: serpapiQuota() });

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Checks the query from the URL. Throws HotelsError("bad_request") when it can't be searched. */
export function parseHotelsQuery(p: URLSearchParams, now: Date = new Date()): HotelsQuery {
  const city = p.get("city") ?? "";
  const checkin = p.get("checkin") ?? "";
  const checkout = p.get("checkout") ?? "";
  const adults = Math.round(Number(p.get("adults") ?? 2));
  const bad = (m: string) => new HotelsError("bad_request", m, 400);
  if (!findCity(city)) throw bad("Unknown city");
  if (!DATE.test(checkin) || !DATE.test(checkout) || Number.isNaN(Date.parse(checkin)) || Number.isNaN(Date.parse(checkout))) throw bad("Dates must look like 2026-11-20");
  if (checkout <= checkin) throw bad("Check-out must be after check-in");
  if (checkout < now.toISOString().slice(0, 10)) throw bad("Those dates are in the past");
  if (!Number.isFinite(adults) || adults < 1 || adults > 10) throw bad("Guests must be 1 to 10");
  return { city, checkin, checkout, adults };
}

export async function liveHotels(q: HotelsQuery, opts: { fetchImpl?: typeof fetch; now?: () => number } = {}): Promise<HotelsResult> {
  const now = opts.now ?? Date.now;
  const k = [q.city, q.checkin, q.checkout, q.adults].join("|");
  const hit = cache.get(k);
  if (hit && now() - hit.at < HOTELS_CACHE_MS) return { ...hit.value, quota: serpapiQuota() };

  const key = process.env.SERPAPI_KEY;
  if (!key) throw new HotelsError("no_key", "Live prices need a SerpApi key. See docs/SETUP_GUIDE.md.", 503);
  if (!consumeSerpapi()) {
    const quota = serpapiQuota();
    throw new HotelsError("quota", `This month's live searches are used up (${quota.used}/${quota.limit}).`, 429);
  }
  let hotels;
  try {
    hotels = await serpapiHotels(q, findCity(q.city)!, key, opts.fetchImpl);
  } catch (e) {
    refundSerpapi(); // SerpApi doesn't bill a search that failed
    throw new HotelsError("upstream", e instanceof Error ? e.message : "Hotel price search failed.", 502);
  }
  const value: HotelsResult = {
    query: q,
    source: "serpapi_google_hotels",
    currency: "USD",
    hotels,
    fetchedAt: new Date(now()).toISOString(),
    quota: serpapiQuota(),
  };
  cache.set(k, { at: now(), value });
  return value;
}

export function resetHotelsCache() {
  cache.clear();
}
