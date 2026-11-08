import { findCity } from "@/lib/cities";
import { findPlaceByName } from "@/lib/places/match";
import { cachedRatings } from "@/lib/places/ratings";
import { cityPlaces } from "@/lib/places/wikivoyage";

/**
 * POST `{ places: [{ city, name }] }`: the ratings the server already remembers for plan items.
 * This never asks the ratings provider for anything, so viewing a plan spends no quota.
 * Answers `{ ratings: { "BJS|Da Dong": { rating, count } } }` for the places that have one.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { places?: { city?: unknown; name?: unknown }[] } | null;
  const wanted = (Array.isArray(body?.places) ? body.places : [])
    .slice(0, 80)
    .flatMap((p) => (typeof p.city === "string" && typeof p.name === "string" && p.name.length <= 120 && findCity(p.city) ? [{ city: p.city, name: p.name }] : []));

  const ratings: Record<string, { rating: number; count?: number }> = {};
  for (const city of new Set(wanted.map((w) => w.city))) {
    const { places } = await cityPlaces(city);
    const known = cachedRatings(city, places);
    for (const w of wanted.filter((x) => x.city === city)) {
      const hit = findPlaceByName(places, w.name);
      const r = hit && known[hit.id];
      if (r && r.rating !== undefined) ratings[`${city}|${w.name}`] = { rating: r.rating, ...(r.count !== undefined ? { count: r.count } : {}) };
    }
  }
  return Response.json({ ratings }, { headers: { "Cache-Control": "no-store" } });
}
