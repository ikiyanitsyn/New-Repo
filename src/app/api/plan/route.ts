import { findCity } from "@/lib/cities";
import { makePlan, type PlanOptions } from "@/lib/ai/plan";
import { AiError } from "@/lib/ai/provider";
import { PlanRequest } from "@/lib/ai/schema";

// The planner stops itself after about 75 seconds and returns what it has; this leaves headroom.
export const maxDuration = 90;

function describeError(e: unknown): { status: number; error: string } {
  const status = e instanceof AiError && e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
  return { status, error: e instanceof Error && e.message ? e.message : "The planner couldn't finish. Try again." };
}

/**
 * POST a PlanRequest. With `Accept: application/x-ndjson` the reply streams one JSON object per line:
 * `{type:"progress", message, done, total}` while working, then `{type:"result", ...PlanResult}`
 * or `{type:"error", error, status}`. Otherwise it answers once with the PlanResult as JSON.
 */
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

  // Stop calling Gemini (and spending quota) as soon as the browser cancels or goes away.
  const cancel = new AbortController();
  const signal = AbortSignal.any([cancel.signal, request.signal]);

  if (!(request.headers.get("accept") ?? "").includes("application/x-ndjson")) {
    try {
      return Response.json(await makePlan(r, { signal }));
    } catch (e) {
      const { status, error } = describeError(e);
      return Response.json({ error }, { status });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // The browser has gone; nothing to send to.
        }
      };
      const opts: PlanOptions = { signal, onProgress: (p) => send({ type: "progress", ...p }) };
      try {
        send({ type: "result", ...(await makePlan(r, opts)) });
      } catch (e) {
        send({ type: "error", ...describeError(e) });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
    cancel() {
      cancel.abort();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
