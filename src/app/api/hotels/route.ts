import type { NextRequest } from "next/server";
import { HotelsError, hotelsStatus, liveHotels, parseHotelsQuery } from "@/lib/hotels/live";

/**
 * GET /api/hotels?city=BJS&checkin=2026-11-20&checkout=2026-11-23&adults=2
 *   Live hotel prices (SerpApi Google Hotels). Costs one search unless cached.
 * GET /api/hotels?status=1
 *   Whether a key is set and how much of the monthly allowance is used. Free.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("status")) return Response.json(hotelsStatus(), { headers: { "Cache-Control": "no-store" } });
  try {
    const result = await liveHotels(parseHotelsQuery(params));
    return Response.json(result, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    if (e instanceof HotelsError) return Response.json({ error: e.message, code: e.code }, { status: e.status, headers: { "Cache-Control": "no-store" } });
    return Response.json({ error: "Hotel price search failed.", code: "upstream" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
