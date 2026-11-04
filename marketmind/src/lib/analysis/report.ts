import "server-only";
import type { Bar, NewsDigest, Outlook, Quote } from "../types";
import { getNewsDigest } from "../news/service";
import { getQuote, getSeries } from "../market/service";
import { newsExposure, type NewsExposure } from "./newsImpact";
import { buildOutlook } from "./outlook";

export interface SymbolReport {
  quote: Quote;
  bars: Bar[];
  outlooks: Outlook[]; // 1 week, 1 month, 3 months
  news: NewsExposure;
  digest: Pick<NewsDigest, "geoRisk" | "sample" | "sources">;
  related: NewsDigest["articles"];
}

export const HORIZONS = [5, 21, 63];

export async function symbolReport(symbol: string): Promise<SymbolReport> {
  const [series, quote, digest] = await Promise.all([getSeries(symbol), getQuote(symbol), getNewsDigest()]);
  const news = newsExposure(quote.instrument.symbol, digest);
  const outlooks = HORIZONS.map((h) => buildOutlook(quote.instrument, quote.technicals, news, digest.geoRisk, h, quote.source === "sample"));
  const titles = new Set(news.contributions.map((c) => c.title));
  const related = digest.articles.filter((a) => titles.has(a.title) || a.tickers.includes(quote.instrument.symbol)).slice(0, 15);
  return {
    quote,
    bars: series.bars,
    outlooks,
    news,
    digest: { geoRisk: digest.geoRisk, sample: digest.sample, sources: digest.sources },
    related,
  };
}
