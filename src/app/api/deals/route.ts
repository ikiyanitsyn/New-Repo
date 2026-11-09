import type { NextRequest } from "next/server";
import { z } from "zod";
import { findCity } from "@/lib/cities";
import { getDeals } from "@/lib/deals/service";
import { refreshSerpapiUsage } from "@/lib/serpapiQuota";

// `from` must be a US departure city; `to` any catalog city. Live mode spends SerpApi quota.
const Query = z.object({
  from: z.string().length(3).refine((c) => findCity(c)?.country === "US", "Unknown departure city"),
  to: z.string().length(3).refine((c) => Boolean(findCity(c)), "Unknown destination city").optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM").optional(),
  nights: z.coerce.number().int().min(1).max(60).optional(),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  cabin: z.enum(["economy", "premium", "business", "first"]).default("economy"),
  mode: z.enum(["analytics", "live"]).default("analytics"),
});

export async function GET(request: NextRequest) {
  const raw = Object.fromEntries([...request.nextUrl.searchParams].filter(([, v]) => v !== ""));
  const parsed = Query.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { mode, ...q } = parsed.data;
  if (mode === "live") await refreshSerpapiUsage();
  const result = await getDeals(q, mode);
  return Response.json(result, {
    // Fare trends move slowly; let the browser keep them for an hour. Live answers are per person.
    headers: { "Cache-Control": mode === "live" ? "private, max-age=3600" : "private, max-age=3600, stale-while-revalidate=21600" },
  });
}
