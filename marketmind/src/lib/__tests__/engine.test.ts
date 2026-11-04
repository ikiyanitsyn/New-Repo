import { describe, expect, it } from "vitest";
import { computeTechnicals, rsi, sma } from "../market/indicators";
import { sampleBars } from "../market/sample";
import { parseStooqCsv, parseYahooChart } from "../market/providers";
import { parseFeed } from "../news/rss";
import { analyzeArticle, buildDigest, newsExposure } from "../analysis/newsImpact";
import { buildOutlook } from "../analysis/outlook";
import { sampleArticles } from "../news/sample";
import { PERSONAS, type TradeContext } from "../advisors/personas";
import { offlineDebate } from "../advisors/debate";
import { instrumentFor } from "../universe";
import type { Article, DebateEvent, TradeIdea } from "../types";

const art = (title: string, summary = ""): Article => ({ id: title, sourceId: "t", sourceName: "Test", title, summary, url: null, published: Date.now(), sample: false });

describe("indicators", () => {
  it("computes SMA and RSI", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(rsi(up)[29]).toBe(100);
  });
  it("classifies a steady uptrend as up", () => {
    const bars = Array.from({ length: 300 }, (_, i) => {
      const c = 100 * Math.exp(i * 0.002 + Math.sin(i / 5) * 0.01);
      return { t: i * 864e5, o: c, h: c * 1.01, l: c * 0.99, c, v: 1 };
    });
    const t = computeTechnicals(bars);
    expect(t.trendScore).toBeGreaterThan(18);
    expect(["up", "strong-up"]).toContain(t.trend);
  });
  it("sample bars end at the anchor and are deterministic", () => {
    const a = sampleBars("SPY");
    expect(a.at(-1)!.c).toBeCloseTo(683, 0);
    expect(sampleBars("SPY")[100].c).toBe(a[100].c);
    expect(a.every((b) => b.h >= b.l && b.l > 0)).toBe(true);
  });
});

describe("providers", () => {
  it("parses Yahoo chart JSON", () => {
    const ts = Array.from({ length: 40 }, (_, i) => 1700000000 + i * 86400);
    const r = parseYahooChart({ chart: { result: [{ meta: { currency: "USD", longName: "Test Co" }, timestamp: ts, indicators: { quote: [{ open: ts.map(() => 1), high: ts.map(() => 2), low: ts.map(() => 0.5), close: ts.map((_, i) => (i === 3 ? null : 1.5)), volume: ts.map(() => 10) }] } }] } });
    expect(r?.bars.length).toBe(39);
    expect(r?.name).toBe("Test Co");
  });
  it("parses Stooq CSV", () => {
    const bars = parseStooqCsv("Date,Open,High,Low,Close,Volume\n2026-01-02,1,2,0.5,1.5,100\n2026-01-05,1.5,2,1,1.8,90");
    expect(bars.map((b) => b.c)).toEqual([1.5, 1.8]);
  });
});

describe("rss", () => {
  it("parses RSS items and strips Google News suffixes", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Oil surges on Hormuz fears - Reuters]]></title><link>https://x.com/a</link><description>&lt;p&gt;Crude &amp;amp; gas&lt;/p&gt;</description><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
    const items = parseFeed(xml, "reuters", "Reuters");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Oil surges on Hormuz fears");
    expect(items[0].url).toBe("https://x.com/a");
    expect(items[0].summary).toContain("Crude");
  });
  it("parses Atom feeds", () => {
    const xml = `<feed><entry><title>Fed signals rate cuts</title><link href="https://y.com/b"/><updated>2026-11-02T10:00:00Z</updated></entry></feed>`;
    expect(parseFeed(xml, "s", "S")[0].url).toBe("https://y.com/b");
  });
});

describe("news impact", () => {
  it("routes Middle East escalation into oil up, airlines down", () => {
    const a = analyzeArticle(art("Israel and Iran trade strikes, raising fears of wider Middle East war"));
    const get = (s: string) => a.impacts.find((i) => i.symbol === s)?.score ?? 0;
    expect(get("USO")).toBeGreaterThan(0);
    expect(get("JETS")).toBeLessThan(0);
    expect(a.themes.some((t) => t.geopolitical)).toBe(true);
  });
  it("flips the sign on a ceasefire", () => {
    const a = analyzeArticle(art("Gaza ceasefire talks gain momentum, easing pressure on oil"));
    expect(a.impacts.find((i) => i.symbol === "USO")!.score).toBeLessThan(0);
  });
  it("reads dovish and hawkish Fed headlines", () => {
    const dove = analyzeArticle(art("Fed signals rate cuts are coming as inflation cools"));
    const hawk = analyzeArticle(art("Fed officials turn hawkish, warn of higher for longer rates"));
    expect(dove.impacts.find((i) => i.symbol === "TLT")!.score).toBeGreaterThan(0);
    expect(hawk.impacts.find((i) => i.symbol === "TLT")!.score).toBeLessThan(0);
  });
  it("scores company-specific headlines by tone", () => {
    const a = analyzeArticle(art("Tesla deliveries miss estimates as EV price war intensifies"));
    expect(a.tickers).toContain("TSLA");
    expect(a.impacts.find((i) => i.symbol === "TSLA")!.score).toBeLessThan(0);
  });
  it("builds a digest with geopolitical risk and theme summaries", () => {
    const d = buildDigest(sampleArticles(), [], true);
    expect(d.geoRisk.index).toBeGreaterThan(0);
    expect(d.themes.length).toBeGreaterThan(5);
    expect(newsExposure("XLE", d).score).toBeGreaterThan(0);
  });
});

describe("outlook and debate", () => {
  const bars = sampleBars("NVDA");
  const t = computeTechnicals(bars);
  const digest = buildDigest(sampleArticles(), [], true);
  const inst = instrumentFor("NVDA");
  const outlook = buildOutlook(inst, t, newsExposure("NVDA", digest), digest.geoRisk, 21, true);

  it("keeps probabilities sane and scenarios ordered", () => {
    expect(outlook.probUp).toBeGreaterThanOrEqual(0.2);
    expect(outlook.probUp).toBeLessThanOrEqual(0.8);
    const [bull, base, bear] = outlook.scenarios;
    expect(bull.target).toBeGreaterThan(base.target);
    expect(base.target).toBeGreaterThan(bear.target);
    expect(bull.probability + base.probability + bear.probability).toBeCloseTo(1, 5);
  });

  const ctxFor = (trade: TradeIdea): TradeContext => ({ trade, inst: instrumentFor(trade.symbol), t: computeTechnicals(sampleBars(trade.symbol)), outlook, geo: digest.geoRisk, newsScore: 0 });

  it("Dave Ramsey hates options and debt, likes long-term index investing", () => {
    const ramsey = PERSONAS.find((p) => p.id === "ramsey")!;
    expect(ramsey.evaluate(ctxFor({ symbol: "NVDA", action: "buy-calls", amount: 5000, horizon: "weeks", thesis: "", hasDebt: true })).stance).toBe(-2);
    expect(ramsey.evaluate(ctxFor({ symbol: "VTI", action: "dca", amount: 500, horizon: "years", thesis: "retirement" })).stance).toBeGreaterThanOrEqual(1);
  });

  it("runs a full offline debate to a verdict", async () => {
    const events: DebateEvent[] = [];
    for await (const e of offlineDebate(ctxFor({ symbol: "NVDA", action: "buy", amount: 10000, horizon: "months", thesis: "AI capex keeps growing for years" }), ["ramsey", "wood", "buffett", "dalio"], 0)) events.push(e);
    expect(events.filter((e) => e.type === "turn_start")).toHaveLength(12);
    const v = events.find((e) => e.type === "verdict")!.verdict!;
    expect(v.votes).toHaveLength(4);
    expect(v.saferAlternative.length).toBeGreaterThan(10);
    const wood = v.votes.find((x) => x.advisorId === "wood")!;
    const ramsey = v.votes.find((x) => x.advisorId === "ramsey")!;
    expect(wood.stance).toBeGreaterThan(ramsey.stance);
  });
});
