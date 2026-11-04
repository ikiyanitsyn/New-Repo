import { findCity } from "@/lib/cities";
import { makePlan } from "@/lib/ai/plan";
import { AiError } from "@/lib/ai/provider";
import { PlanRequest } from "@/lib/ai/schema";

// Writing a full itinerary can take a while on the free model.
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = PlanRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "The trip details were incomplete. Reload the page and try again." }, { status: 400 });
  }
  const r = parsed.data;
  if (!findCity(r.trip.home) || r.trip.stops.some((s) => !findCity(s.city))) {
    return Response.json({ error: "The trip includes a city the planner doesn't know." }, { status: 400 });
  }
  try {
    return Response.json(await makePlan(r));
  } catch (e) {
    const status = e instanceof AiError && e.status === 429 ? 429 : 502;
    return Response.json({ error: e instanceof Error ? e.message : "The planner couldn't finish. Try again." }, { status });
  }
}
