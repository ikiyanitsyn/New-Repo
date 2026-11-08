import type { NextRequest } from "next/server";
import { z } from "zod";
import { findCity, flightCodeOf, getCity } from "@/lib/cities";
import { priceCalendar } from "@/lib/flights/calendar";

const Query = z.object({
  from: z.string().length(3).refine((c) => Boolean(findCity(c)), "Unknown origin city"),
  to: z.string().length(3).refine((c) => Boolean(findCity(c)), "Unknown destination city"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  cabin: z.enum(["economy", "premium", "business", "first"]).default("economy"),
});

/** Lowest price for each of the 7 days around a date (Travelpayouts month data, or sample prices without a token). */
export async function GET(request: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const q = parsed.data;
  if (flightCodeOf(getCity(q.from)) === flightCodeOf(getCity(q.to))) {
    return Response.json({ error: "These cities share the same airports." }, { status: 400 });
  }
  return Response.json(await priceCalendar(q), { headers: { "Cache-Control": "private, max-age=600" } });
}
