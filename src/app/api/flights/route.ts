import type { NextRequest } from "next/server";
import { z } from "zod";
import { findCity } from "@/lib/cities";
import { searchFlights } from "@/lib/flights/search";

const Query = z.object({
  from: z.string().length(3).refine((c) => findCity(c), "Unknown origin city"),
  to: z.string().length(3).refine((c) => findCity(c), "Unknown destination city"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  cabin: z.enum(["economy", "premium", "business", "first"]).default("economy"),
  direct: z.enum(["0", "1"]).default("0"),
  mode: z.enum(["cached", "live"]).default("cached"),
});

export async function GET(request: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { from, to, date, adults, cabin, direct, mode } = parsed.data;
  if (from === to) return Response.json({ error: "Origin and destination are the same city." }, { status: 400 });

  const result = await searchFlights({ from, to, date, adults, cabin, directOnly: direct === "1" }, mode);
  return Response.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
}
