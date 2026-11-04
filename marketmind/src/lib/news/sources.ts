import type { NewsSource } from "../types";

/**
 * The five market news services MarketMind researches. Each has a few public RSS feeds
 * (markets, economy, world/politics) so geopolitical stories are covered as well as markets.
 * Reuters retired its public RSS, so its stories come through a Google News query scoped to reuters.com.
 */
export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "bloomberg",
    name: "Bloomberg",
    short: "BBG",
    homepage: "https://www.bloomberg.com/markets",
    domain: "bloomberg.com",
    feeds: [
      "https://feeds.bloomberg.com/markets/news.rss",
      "https://feeds.bloomberg.com/economics/news.rss",
      "https://feeds.bloomberg.com/politics/news.rss",
    ],
  },
  {
    id: "reuters",
    name: "Reuters",
    short: "RTRS",
    homepage: "https://www.reuters.com/markets/",
    domain: "reuters.com",
    feeds: [
      "https://news.google.com/rss/search?q=site:reuters.com+markets+OR+stocks+when:2d&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=site:reuters.com+world+OR+sanctions+OR+conflict+when:2d&hl=en-US&gl=US&ceid=US:en",
    ],
  },
  {
    id: "wsj",
    name: "The Wall Street Journal",
    short: "WSJ",
    homepage: "https://www.wsj.com/finance",
    domain: "wsj.com",
    feeds: [
      "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",
      "https://feeds.content.dowjones.io/public/rss/RSSWorldNews",
      "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    ],
  },
  {
    id: "cnbc",
    name: "CNBC",
    short: "CNBC",
    homepage: "https://www.cnbc.com/markets/",
    domain: "cnbc.com",
    feeds: [
      "https://www.cnbc.com/id/100003114/device/rss/rss.html",
      "https://www.cnbc.com/id/20910258/device/rss/rss.html",
      "https://www.cnbc.com/id/100727362/device/rss/rss.html",
    ],
  },
  {
    id: "yahoo",
    name: "Yahoo Finance",
    short: "YF",
    homepage: "https://finance.yahoo.com/",
    domain: "finance.yahoo.com",
    feeds: [
      "https://finance.yahoo.com/news/rssindex",
      "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,SPY,QQQ,CL=F,GC=F&region=US&lang=en-US",
    ],
  },
];

export const SOURCE_DOMAINS = NEWS_SOURCES.map((s) => s.domain);
