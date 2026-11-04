import "server-only";
import type { Article, NewsDigest } from "../types";
import { cached } from "../cache";
import { buildDigest } from "../analysis/newsImpact";
import { NEWS_SOURCES } from "./sources";
import { parseFeed } from "./rss";
import { sampleArticles } from "./sample";

const NEWS_TTL = 10 * 60 * 1000;

async function fetchFeed(url: string, sourceId: string, sourceName: string): Promise<Article[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketMind/1.0; +https://github.com/)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), sourceId, sourceName);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function getNewsDigest(): Promise<NewsDigest> {
  return cached("news:digest", NEWS_TTL, async () => {
    const offline = process.env.MARKETMIND_OFFLINE === "1" || process.env.MARKETMIND_OFFLINE === "true";
    const perSource = offline
      ? NEWS_SOURCES.map(() => [] as Article[])
      : await Promise.all(
          NEWS_SOURCES.map(async (s) => (await Promise.all(s.feeds.map((f) => fetchFeed(f, s.id, s.name)))).flat()),
        );
    const weekAgo = Date.now() - 7 * 864e5;
    const live = perSource.flat().filter((a) => a.published > weekAgo);
    const sources = NEWS_SOURCES.map((s, i) => ({
      id: s.id,
      name: s.name,
      status: perSource[i].length ? ("live" as const) : ("unavailable" as const),
      count: perSource[i].length,
    }));
    if (live.length === 0) return buildDigest(sampleArticles(), sources, true);
    return buildDigest(live, sources, false);
  });
}
