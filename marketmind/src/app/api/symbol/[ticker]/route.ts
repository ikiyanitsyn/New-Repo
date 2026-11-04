import type { NextRequest } from "next/server";
import { symbolReport } from "@/lib/analysis/report";
import { normalizeSymbol } from "@/lib/universe";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const symbol = normalizeSymbol(decodeURIComponent(ticker));
  if (!symbol) return Response.json({ error: "Unknown ticker" }, { status: 400 });
  return Response.json(await symbolReport(symbol));
}
