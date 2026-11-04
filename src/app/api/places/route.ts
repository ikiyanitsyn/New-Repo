import type { NextRequest } from "next/server";
import { findCity } from "@/lib/cities";
import { cityPlaces } from "@/lib/places/wikivoyage";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("city") ?? "";
  if (!findCity(code)) return Response.json({ error: "Unknown city" }, { status: 400 });

  const result = await cityPlaces(code);
  return Response.json(result, {
    // Let the hosting CDN keep guide data for a day; it changes slowly.
    headers: { "Cache-Control": result.error ? "no-store" : "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
