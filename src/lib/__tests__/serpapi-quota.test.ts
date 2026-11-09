import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeSerpapi, refreshSerpapiUsage, resetSerpapiQuota, serpapiQuota } from "../serpapiQuota";

describe("SerpApi searches-left counter", () => {
  afterEach(() => { resetSerpapiQuota(); delete process.env.SERPAPI_KEY; delete process.env.SERPAPI_MONTHLY_LIMIT; });

  it("takes the real usage from the SerpApi account, so restarts don't reset it", async () => {
    process.env.SERPAPI_KEY = "k";
    process.env.SERPAPI_MONTHLY_LIMIT = "200";
    const fetcher = vi.fn(async (url: string) => url && new Response(JSON.stringify({ this_month_usage: 37, searches_per_month: 250 })));
    await refreshSerpapiUsage(fetcher as never);
    expect(serpapiQuota()).toEqual({ used: 37, limit: 200 });
    expect(String(fetcher.mock.calls[0][0])).toMatch(/serpapi\.com\/account\.json\?api_key=k/);
  });

  it("uses the plan's size when it's below the app's own stop", async () => {
    process.env.SERPAPI_KEY = "k";
    process.env.SERPAPI_MONTHLY_LIMIT = "500";
    await refreshSerpapiUsage((async () => new Response(JSON.stringify({ this_month_usage: 3, searches_per_month: 250 }))) as never);
    expect(serpapiQuota().limit).toBe(250);
  });

  it("checks at most every two minutes and keeps local counts", async () => {
    process.env.SERPAPI_KEY = "k";
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ this_month_usage: 10, searches_per_month: 250 })));
    const t0 = new Date("2026-11-09T10:00:00Z");
    await refreshSerpapiUsage(fetcher as never, t0);
    consumeSerpapi(t0);
    await refreshSerpapiUsage(fetcher as never, new Date("2026-11-09T10:01:00Z"));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(serpapiQuota(t0).used).toBe(11);
  });

  it("keeps the local count when the account check fails", async () => {
    process.env.SERPAPI_KEY = "k";
    consumeSerpapi();
    await refreshSerpapiUsage((async () => { throw new Error("offline"); }) as never);
    expect(serpapiQuota().used).toBe(1);
  });
});
