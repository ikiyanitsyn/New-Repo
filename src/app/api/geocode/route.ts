import type { NextRequest } from "next/server";
import { geocode } from "@/lib/places/geocode";

/** Search any place by name (OpenStreetMap). Used when a stay isn't in the city list. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return Response.json({ places: [] });
  try {
    const places = await geocode(q);
    return Response.json({ places }, { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } });
  } catch (e) {
    return Response.json({ places: [], error: e instanceof Error ? e.message : "Place search failed." }, { status: 502 });
  }
}
