/**
 * One monthly safety counter for every SerpApi search the app makes
 * (Google Flights and Google Hotels share the same SerpApi allowance).
 * SERPAPI_MONTHLY_LIMIT is the app's own stop, set below the real limit.
 *
 * The state lives on globalThis so route bundles that import this module
 * separately still share one count. Phase 4 moves it into the database.
 */

interface Usage { month: string; used: number }

const SLOT = Symbol.for("in.serpapi.usage");
const store = globalThis as unknown as Record<symbol, Usage | undefined>;
const usage = (): Usage => (store[SLOT] ??= { month: "", used: 0 });

export const serpapiLimit = () => Number(process.env.SERPAPI_MONTHLY_LIMIT || 200);

/** Searches used this month and the app's limit. Rolls over on the first of the month (UTC). */
export function serpapiQuota(now: Date = new Date()): { used: number; limit: number } {
  const u = usage();
  const month = now.toISOString().slice(0, 7);
  if (u.month !== month) Object.assign(u, { month, used: 0 });
  return { used: u.used, limit: serpapiLimit() };
}

/** Counts one search. Returns false, and counts nothing, when the month's limit is reached. */
export function consumeSerpapi(now: Date = new Date()): boolean {
  const q = serpapiQuota(now);
  if (q.used >= q.limit) return false;
  usage().used++;
  return true;
}

/** Gives one search back, for a call that failed before SerpApi ran a search. */
export function refundSerpapi(): void {
  const u = usage();
  if (u.used > 0) u.used--;
}

export function resetSerpapiQuota(): void {
  Object.assign(usage(), { month: "", used: 0 });
}
