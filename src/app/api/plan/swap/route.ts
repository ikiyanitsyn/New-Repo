import { findCity } from "@/lib/cities";
import { AiError, getProvider } from "@/lib/ai/provider";
import { SwapRequest } from "@/lib/ai/schema";
import { swapItem } from "@/lib/ai/swap";
import { cityPlaces } from "@/lib/places/wikivoyage";

export const maxDuration = 60;

/**
 * POST a SwapRequest: one plan item and its day. Answers `{source, options[]}` with up to three
 * alternatives, or `{error}` with a plain-English message (quota, busy, bad reply).
 */
export async function POST(request: Request) {
  const parsed = SwapRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !findCity(parsed.data.city)) {
    return Response.json({ error: "That item couldn't be read. Reload the page and try again." }, { status: 400 });
  }
  const r = parsed.data;
  if (r.item.kind === "travel") {
    return Response.json({ error: "Travel items can't be swapped. Remove it or edit the route instead." }, { status: 400 });
  }
  try {
    const guide = await cityPlaces(r.city);
    const result = await swapItem(r, getProvider(), guide.places, { signal: request.signal });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof AiError && e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    const error = e instanceof Error && e.message ? e.message : "Couldn't find alternatives. Try again.";
    return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
