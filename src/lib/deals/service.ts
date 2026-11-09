import { consumeSerpapi, refundSerpapi, resetSerpapiQuota, serpapiQuota } from "../serpapiQuota";
import "server-only";
import { sampleLive, sampleMonths, samplePopular } from "./sample";
import { exploreDeals } from "./serpapi";
import { monthlyPrices, popularFrom } from "./travelpayouts";
import type { DealsQuery, DealsResult } from "./types";

/**
 * Home-page deals, cached in memory so the free tiers last (the same pattern
 * as src/lib/flights/search.ts):
 *  - "analytics" (default): Travelpayouts cheapest-by-month + popular
 *    destinations, cached 6 hours. Sample data when no token is set.
 *  - "live": SerpApi Google Travel Explore, only from an explicit button,
 *    cached 12 hours and counted against a monthly limit.
 * The live counter is separate from the flight search's, so it has its own
 * smaller limit (SERPAPI_DEALS_MONTHLY_LIMIT, default 20) to protect the
 * shared SerpApi allowance.
 */

const TTL = { analytics: 6 * 3600_000, live: 12 * 3600_000 };
const cache = new Map<string, { at: number; value: DealsResult }>();
// Live deals share the one SerpApi allowance with flights and hotels.
const liveQuota = () => serpapiQuota();

const key = (mode: string, q: DealsQuery) =>
  mode === "live" ? [mode, q.from, q.to ?? "", q.month ?? "", q.nights ?? "", q.adults, q.cabin].join("|") : [mode, q.from, q.to ?? ""].join("|");

export type DealsMode = "analytics" | "live";

/** For tests: forget cached answers and the live counter. */
export function resetDealsCache() {
  cache.clear();
  resetSerpapiQuota();
}

export async function getDeals(q: DealsQuery, mode: DealsMode, fetcher: typeof fetch = fetch): Promise<DealsResult> {
  const k = key(mode, q);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL[mode]) return { ...hit.value, liveQuota: liveQuota() };

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  const serpKey = process.env.SERPAPI_KEY;
  const base = { query: q, liveAvailable: Boolean(serpKey), fetchedAt: new Date().toISOString(), notices: [] as string[] };

  let result: DealsResult;
  if (mode === "live") {
    const quota = liveQuota();
    if (!serpKey) {
      return { ...base, source: "sample", months: [], popular: [], live: sampleLive(q.from), liveSource: "sample", notices: ["Sample live deals. Add a SerpApi key to search Google Travel Explore (docs/SETUP_GUIDE.md)."], liveQuota: quota };
    }
    if (quota.used >= quota.limit) {
      return { ...base, source: "serpapi", months: [], popular: [], live: [], liveSource: "serpapi", notices: [`This month's live deal searches are used up (${quota.used}/${quota.limit}).`], liveQuota: quota };
    }
    if (!consumeSerpapi()) {
      return { ...base, source: "serpapi", months: [], popular: [], live: [], liveSource: "serpapi", notices: ["This month's live searches are used up."], liveQuota: liveQuota() };
    }
    try {
      const live = await exploreDeals(q, serpKey, fetcher);
      result = { ...base, source: "serpapi", months: [], popular: [], live, liveSource: "serpapi", liveQuota: liveQuota() };
      if (!live.length) result.notices.push("Google Travel Explore had no prices for this search. Try another month.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Live deals failed.";
      refundSerpapi();
      return { ...base, source: "sample", months: [], popular: [], live: sampleLive(q.from), liveSource: "sample", notices: [`${message} Showing sample deals instead.`], liveQuota: liveQuota() };
    }
  } else if (token) {
    const [months, popular] = await Promise.allSettled([
      q.to ? monthlyPrices(q.from, q.to, token, fetcher) : Promise.resolve([]),
      popularFrom(q.from, token, fetcher),
    ]);
    const notices: string[] = [];
    if (months.status === "rejected") notices.push("Month-by-month prices are unavailable right now.");
    if (popular.status === "rejected") notices.push("Popular destinations are unavailable right now.");
    result = {
      ...base,
      source: "travelpayouts",
      months: months.status === "fulfilled" ? months.value : [],
      popular: popular.status === "fulfilled" ? popular.value.slice(0, 8) : [],
      notices,
      liveQuota: liveQuota(),
    };
    // Don't cache a complete failure; try again on the next visit.
    if (months.status === "rejected" && popular.status === "rejected") return result;
  } else {
    result = {
      ...base,
      source: "sample",
      months: q.to ? sampleMonths(q.from, q.to) : [],
      popular: samplePopular(q.from),
      notices: ["Sample prices. Add a Travelpayouts token to see real fare trends (docs/SETUP_GUIDE.md)."],
      liveQuota: liveQuota(),
    };
  }

  cache.set(k, { at: Date.now(), value: result });
  return result;
}
