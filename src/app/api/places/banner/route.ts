import type { NextRequest } from "next/server";
import { findCity } from "@/lib/cities";
import { cityBanner } from "@/lib/places/banner";

/** GET /api/places/banner?city=NAP[&w=1920] — a city's hero photo (or null). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("city") ?? "";
  if (!findCity(code)) return Response.json({ error: "Unknown city" }, { status: 400 });
  const w = Math.min(2560, Math.max(320, Number(request.nextUrl.searchParams.get("w")) || 1920));
  const banner = await cityBanner(code, w);
  return Response.json(banner, {
    headers: { "Cache-Control": banner.url ? "public, s-maxage=604800, stale-while-revalidate=2592000" : "no-store" },
  });
}
