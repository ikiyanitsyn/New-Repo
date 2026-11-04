import { getQuotes } from "@/lib/market/service";
import { normalizeSymbol } from "@/lib/universe";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("symbols") ?? "";
  const symbols = [...new Set(raw.split(",").map((s) => normalizeSymbol(decodeURIComponent(s))).filter(Boolean))].slice(0, 60);
  const quotes = await getQuotes(symbols);
  return Response.json({
    quotes: quotes.map((q) => ({
      symbol: q.instrument.symbol,
      name: q.instrument.name,
      cls: q.instrument.cls,
      last: q.technicals.last,
      d1: q.technicals.change1d,
      m1: q.technicals.change1m,
      trend: q.technicals.trend,
      spark: q.spark.slice(-30),
      source: q.source,
    })),
  });
}
