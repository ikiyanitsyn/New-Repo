import { z } from "zod";
import { customPlaceOf, isCustomCode, registerPlaces, type CustomPlace } from "../cities";

/**
 * Places found by search live in the traveller's trip, not in the server's city list.
 * Requests about one carry its details in a `place` query parameter (or a `places`
 * list in a JSON body), and the server registers it before looking the code up.
 */
export const CustomPlaceSchema = z.object({
  code: z.string().regex(/^0[0-9A-Z]{5}$/),
  name: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  country: z.string().regex(/^[A-Z]{2}$/),
  countryName: z.string().max(60),
  area: z.string().max(60).optional(),
  kind: z.string().max(40).optional(),
});

/** `{ place: "…" }` to add to a request's query for a custom place; `{}` for catalog cities. */
export function placeParam(code: string | undefined): Record<string, string> {
  const p = code && isCustomCode(code) ? customPlaceOf(code) : undefined;
  return p ? { place: JSON.stringify(p) } : {};
}

/** Register the custom place a request describes (query `place=`). Ignores anything malformed. */
export function registerFromParams(sp: URLSearchParams): void {
  const raw = sp.get("place");
  if (!raw) return;
  try {
    const p = CustomPlaceSchema.safeParse(JSON.parse(raw));
    if (p.success) registerPlaces([p.data]);
  } catch {
    // Not JSON: treat the request as a catalog city.
  }
}

/** Register custom places sent in a JSON body. Returns the ones that were valid. */
export function registerFromList(list: unknown): CustomPlace[] {
  const p = z.array(CustomPlaceSchema).max(20).safeParse(list);
  if (!p.success) return [];
  registerPlaces(p.data);
  return p.data;
}
