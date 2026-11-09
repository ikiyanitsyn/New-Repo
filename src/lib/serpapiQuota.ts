/**
 * One monthly safety counter for every SerpApi search the app makes
 * (Google Flights and Google Hotels share the same SerpApi allowance).
 * SERPAPI_MONTHLY_LIMIT is the app's own stop, set below the real limit.
 *
 * The state lives on globalThis so route bundles that import this module
 * separately still share one count. It is refreshed from SerpApi's own Account
 * API (free; it uses no searches), so the count survives restarts and matches
 * your real SerpApi usage, including searches made elsewhere.
 */

interface Usage { month: string; used: number; plan?: number; checkedAt?: number }

const SLOT = Symbol.for("in.serpapi.usage");
const store = globalThis as unknown as Record<symbol, Usage | undefined>;
const usage = (): Usage => (store[SLOT] ??= { month: "", used: 0 });

export const serpapiLimit = () => Number(process.env.SERPAPI_MONTHLY_LIMIT || 200);

/** Searches used this month and the limit (the lower of the app's stop and your SerpApi plan). */
export function serpapiQuota(now: Date = new Date()): { used: number; limit: number } {
  const u = usage();
  const month = now.toISOString().slice(0, 7);
  if (u.month !== month) Object.assign(u, { month, used: 0, checkedAt: undefined });
  return { used: u.used, limit: Math.min(serpapiLimit(), u.plan ?? Infinity) };
}

const REFRESH_MS = 2 * 60_000;

/**
 * Bring the count up to date from https://serpapi.com/account.json (this_month_usage,
 * searches_per_month). Cached for two minutes; failures keep the local count.
 */
export async function refreshSerpapiUsage(fetcher: typeof fetch = fetch, now: Date = new Date()): Promise<void> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return;
  const u = usage();
  serpapiQuota(now);
  if (u.checkedAt && now.getTime() - u.checkedAt < REFRESH_MS) return;
  try {
    const res = await fetcher(`https://serpapi.com/account.json?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return;
    const j = (await res.json()) as { this_month_usage?: number; searches_per_month?: number };
    if (typeof j.this_month_usage === "number") u.used = Math.max(u.used, j.this_month_usage);
    if (typeof j.searches_per_month === "number" && j.searches_per_month > 0) u.plan = j.searches_per_month;
    u.checkedAt = now.getTime();
  } catch {
    // Keep the local count.
  }
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
  Object.assign(usage(), { month: "", used: 0, plan: undefined, checkedAt: undefined });
}
