import { getNewsDigest } from "@/lib/news/service";
import { dataMode, getQuotes } from "@/lib/market/service";
import { UNIVERSE } from "@/lib/universe";
import { newsExposure } from "@/lib/analysis/newsImpact";
import { buildOutlook } from "@/lib/analysis/outlook";

export async function GET() {
  const [digest, quotes] = await Promise.all([getNewsDigest(), getQuotes(UNIVERSE.map((u) => u.symbol))]);
  const rows = quotes.map((q) => {
    const exp = newsExposure(q.instrument.symbol, digest);
    const o = buildOutlook(q.instrument, q.technicals, exp, digest.geoRisk, 21, q.source === "sample");
    const t = q.technicals;
    return {
      symbol: q.instrument.symbol,
      name: q.instrument.name,
      cls: q.instrument.cls,
      sector: q.instrument.sector,
      last: t.last,
      d1: t.change1d,
      w1: t.change5d,
      m1: t.change1m,
      m3: t.change3m,
      ytd: t.changeYtd,
      y1: t.change1y,
      rsi: t.rsi14,
      vol: t.volAnnual,
      trend: t.trend,
      trendScore: t.trendScore,
      news: exp.score,
      outlook: o.score,
      stance: o.stance,
      probUp: o.probUp,
      spark: q.spark.slice(-30),
      source: q.source,
    };
  });
  return Response.json({ mode: dataMode(quotes), rows });
}
