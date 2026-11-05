import type { NextRequest } from "next/server";
import { findCity } from "@/lib/cities";
import { MAX_IDS_PER_REQUEST, placeRatings, ratingsProvider } from "@/lib/places/ratings";

/**
 * GET /api/places/ratings?city=BJS&ids=m1,m4,d0-12
 * Ratings and short reviews for the listed guide places. Without a provider
 * key it answers { provider: null } and the page shows no ratings.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("city") ?? "";
  if (!findCity(code)) return Response.json({ error: "Unknown city" }, { status: 400 });
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[\w-]{1,24}$/.test(s))
    .slice(0, MAX_IDS_PER_REQUEST);

  const provider = ratingsProvider();
  if (!provider) {
    return Response.json({ provider: null, ratings: {} }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  }

  const result = await placeRatings(code, ids, provider);
  const complete = !result.note && ids.every((id) => id in result.ratings);
  return Response.json(result, {
    // A complete answer can be kept by the CDN for a day; a partial one only briefly.
    headers: { "Cache-Control": complete ? "public, s-maxage=86400, stale-while-revalidate=172800" : "no-store" },
  });
}
