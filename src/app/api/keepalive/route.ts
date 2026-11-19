import { normalizeSupabaseUrl } from "@/lib/cloud/url";

/**
 * GET /api/keepalive: one tiny database read so Supabase's free plan sees activity.
 * Supabase pauses free projects after 7 days without any; Vercel calls this once a day
 * (see vercel.json). It reads nothing private: with the public key and the row-level
 * security rules the query returns no rows, but it still reaches the database.
 *
 * When CRON_SECRET is set in Vercel, only Vercel's scheduler (which sends it) may call this.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Not allowed" }, { status: 401 });
  }
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL).url;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: false, error: "Supabase isn't set up" }, { status: 503 });
  try {
    const res = await fetch(`${url}/rest/v1/trips?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    // A paused project answers with an error: say so plainly in the Vercel logs.
    return Response.json(
      {
        ok: res.ok,
        status: res.status,
        at: new Date().toISOString(),
        ...(res.ok ? {} : { hint: "If the project is paused, restore it in the Supabase dashboard." }),
      },
      { status: res.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Supabase didn't answer" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
