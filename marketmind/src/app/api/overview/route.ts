import { getNewsDigest } from "@/lib/news/service";
import { dataMode, getQuotes } from "@/lib/market/service";
import { ETFS, INDICES, STOCKS } from "@/lib/universe";
import { newsExposure } from "@/lib/analysis/newsImpact";
import { buildOutlook } from "@/lib/analysis/outlook";

const SECTOR_ETFS = ["XLK", "SMH", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLU", "XLRE", "XLB", "ITA"];
const MACRO = ["TLT", "HYG", "GLD", "USO", "UUP", "IBIT", "EEM", "VGK", "FXI"];

export async function GET() {
  const [digest, indices, sectors, macro, stocks] = await Promise.all([
    getNewsDigest(),
    getQuotes(INDICES.map((i) => i.symbol)),
    getQuotes(SECTOR_ETFS),
    getQuotes(MACRO),
    getQuotes(STOCKS.map((s) => s.symbol)),
  ]);
  const spy = indices.find((q) => q.instrument.symbol === "^GSPC")!;
  const marketOutlook = buildOutlook(spy.instrument, spy.technicals, newsExposure("^GSPC", digest), digest.geoRisk, 21, spy.source === "sample");

  // Instruments the current news flow leans on hardest, either way.
  const watch = [...ETFS, ...STOCKS]
    .map((i) => ({ symbol: i.symbol, name: i.name, score: newsExposure(i.symbol, digest).score }))
    .filter((x) => Math.abs(x.score) >= 8)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 10);

  const byMove = [...stocks].sort((a, b) => b.technicals.change1d - a.technicals.change1d);
  const all = [...indices, ...sectors, ...macro, ...stocks];
  return Response.json({
    mode: dataMode(all),
    indices,
    sectors,
    macro,
    gainers: byMove.slice(0, 5),
    losers: byMove.slice(-5).reverse(),
    trendLeaders: [...stocks].sort((a, b) => b.technicals.trendScore - a.technicals.trendScore).slice(0, 5),
    marketOutlook,
    newsWatch: watch,
    news: {
      geoRisk: digest.geoRisk,
      sentiment: digest.sentiment,
      themes: digest.themes.slice(0, 8),
      top: [...digest.articles].sort((a, b) => b.severity - a.severity || b.published - a.published).slice(0, 10),
      sources: digest.sources,
      sample: digest.sample,
    },
  });
}
