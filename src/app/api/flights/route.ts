import type { NextRequest } from "next/server";
import { z } from "zod";
import { findCity, flightCodeOf, getCity } from "@/lib/cities";
import type { LayoverFilter } from "@/lib/flights/layover";
import { searchFlights } from "@/lib/flights/search";

// `from` and `to` are catalog city codes (some are internal, e.g. Kyoto "UKY");
// the flight providers translate them to the IATA code that serves the city.
const Query = z.object({
  from: z.string().length(3).refine((c) => Boolean(findCity(c)), "Unknown origin city"),
  to: z.string().length(3).refine((c) => Boolean(findCity(c)), "Unknown destination city"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  cabin: z.enum(["economy", "premium", "business", "first"]).default("economy"),
  direct: z.enum(["0", "1"]).default("0"),
  mode: z.enum(["cached", "live"]).default("cached"),
  // Stops and layover preferences, used for live (SerpApi) searches only. Cached fares are filtered in the browser.
  stops: z.enum(["any", "0", "1"]).default("any"),
  layMin: z.coerce.number().min(0).max(48).optional(),
  layMax: z.coerce.number().min(0).max(48).optional(),
});

export async function GET(request: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { from, to, date, adults, cabin, direct, mode, stops, layMin, layMax } = parsed.data;
  if (from === to) return Response.json({ error: "Origin and destination are the same city." }, { status: 400 });
  const a = getCity(from);
  const b = getCity(to);
  if (flightCodeOf(a) === flightCodeOf(b)) {
    return Response.json(
      { error: `${a.name} and ${b.name} share the same airports, so there is no flight between them. The train is the easy way.` },
      { status: 400 },
    );
  }

  const filter: LayoverFilter = {
    maxStops: stops === "any" ? null : (Number(stops) as 0 | 1),
    minHours: layMin ?? null,
    maxHours: layMax ?? null,
    airports: [],
  };
  const result = await searchFlights({ from, to, date, adults, cabin, directOnly: direct === "1", filter }, mode);
  return Response.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
}
