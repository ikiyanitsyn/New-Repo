import "server-only";
import { consumeSerpapi, serpapiQuota } from "../serpapiQuota";
import { searchLinks } from "./links";
import { sampleOffers } from "./sample";
import { serpapiSearch } from "./serpapi";
import { travelpayoutsSearch } from "./travelpayouts";
import type { FlightQuery, FlightSearchResult } from "./types";

/**
 * Picks a provider and caches results in memory so the free tiers last.
 *  - "cached" (default): Travelpayouts if a token is set, else sample data.
 *  - "live": SerpApi Google Flights if a key is set and quota remains.
 * Phase 4 moves the cache and the live-search counter into the database
 * so they survive restarts and are shared across server instances.
 */

const CACHE_TTL_MS = { cached: 6 * 3600_000, live: 12 * 3600_000 };
const cache = new Map<string, { at: number; value: FlightSearchResult }>();
// Shared with the hotel prices: one SerpApi allowance for both.
const liveQuota = () => serpapiQuota();

// Stops and layover preferences only change live (SerpApi) searches, so they only belong in the live key.
const key = (mode: string, q: FlightQuery) =>
  [mode, q.from, q.to, q.date, q.adults, q.cabin, q.directOnly, mode === "live" ? JSON.stringify(q.filter ?? null) : ""].join("|");

export async function searchFlights(q: FlightQuery, mode: "cached" | "live"): Promise<FlightSearchResult> {
  const k = key(mode, q);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS[mode]) return { ...hit.value, liveQuota: liveQuota() };

  const tpToken = process.env.TRAVELPAYOUTS_TOKEN;
  const serpKey = process.env.SERPAPI_KEY;
  const base = {
    query: q,
    links: searchLinks(q),
    liveAvailable: Boolean(serpKey),
    fetchedAt: new Date().toISOString(),
  };

  let result: FlightSearchResult;
  try {
    if (mode === "live") {
      if (!serpKey) throw new Error("Live prices need a SerpApi key. See docs/SETUP_GUIDE.md.");
      if (!consumeSerpapi()) {
        const quota = liveQuota();
        throw new Error(`This month's live searches are used up (${quota.used}/${quota.limit}).`);
      }
      const r = await serpapiSearch(q, serpKey);
      result = { ...base, source: "serpapi", offers: r.offers, notices: r.notices };
    } else if (tpToken) {
      const r = await travelpayoutsSearch(q, tpToken);
      result = { ...base, source: "travelpayouts", offers: r.offers, notices: r.notices };
      if (r.offers.length === 0) {
        result.notices.push("No recent cached fares for this route and date. Try live prices or a nearby date.");
      }
    } else {
      result = {
        ...base,
        source: "sample",
        offers: sampleOffers(q),
        notices: ["Sample fares. Add a Travelpayouts token to see real prices (docs/SETUP_GUIDE.md)."],
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Flight search failed.";
    // Never leave the traveller with nothing: fall back to sample fares, clearly labelled.
    return {
      ...base,
      source: "sample",
      offers: sampleOffers(q),
      notices: [`${message} Showing sample fares instead.`],
      liveQuota: liveQuota(),
    };
  }

  cache.set(k, { at: Date.now(), value: result });
  return { ...result, liveQuota: liveQuota() };
}
