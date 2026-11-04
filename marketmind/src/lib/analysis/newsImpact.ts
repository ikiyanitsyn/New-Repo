import type { AnalyzedArticle, Article, Direction, GeoRisk, Instrument, NewsDigest, ThemeHit, ThemeSummary } from "../types";
import { INDEX_PROXY, SECTOR_PROXY, UNIVERSE, findInstrument } from "../universe";
import { INTENSE, NEGATIVE, POSITIVE, REGION_WORDS, THEMES, type ThemeDef } from "./themes";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function countMatches(re: RegExp, text: string): string[] {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  return Array.from(text.matchAll(g), (m) => m[0].toLowerCase());
}

/** Tone of a headline from -1 (very negative) to 1 (very positive). Headline words count double. */
export function sentimentOf(title: string, summary = ""): number {
  const pos = countMatches(POSITIVE, title).length * 2 + countMatches(POSITIVE, summary).length;
  const neg = countMatches(NEGATIVE, title).length * 2 + countMatches(NEGATIVE, summary).length;
  if (pos + neg === 0) return 0;
  return clamp((pos - neg) / (pos + neg + 1), -1, 1);
}

function polarityFor(theme: ThemeDef, text: string, sentiment: number): Direction | 0 {
  switch (theme.mode) {
    case "risk":
      return theme.calm && theme.calm.test(text) ? -1 : 1;
    case "balance": {
      const up = theme.up ? countMatches(theme.up, text).length : 0;
      const down = theme.down ? countMatches(theme.down, text).length : 0;
      if (up > down) return 1;
      if (down > up) return -1;
      if (theme.tieDefault) return theme.tieDefault;
      return sentiment > 0.15 ? 1 : sentiment < -0.15 ? -1 : 0;
    }
    case "sentiment":
      return sentiment > 0.1 ? 1 : sentiment < -0.1 ? -1 : 0;
  }
}

/** Instruments a headline names directly (company names, tickers in parentheses, aliases). */
export function mentionedInstruments(text: string): Instrument[] {
  const found = new Map<string, Instrument>();
  for (const inst of UNIVERSE) {
    if (inst.cls === "etf" && !inst.aliases) continue;
    const names = [...(inst.aliases ?? [])];
    if (inst.cls === "stock") names.push(inst.symbol);
    for (const n of names) {
      if (n.length < 3 && n !== inst.symbol) continue;
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Tickers must be upper-case to avoid matching ordinary words ("META", "COST").
      const re = n === inst.symbol ? new RegExp(`(\\$|\\(|\\b)${esc}\\b(?!-)`) : new RegExp(`\\b${esc}\\b`, "i");
      if (re.test(text)) {
        found.set(inst.symbol, inst);
        break;
      }
    }
  }
  return [...found.values()];
}

export function analyzeArticle(a: Article): AnalyzedArticle {
  const text = `${a.title}. ${a.summary}`;
  const sentiment = sentimentOf(a.title, a.summary);
  const themes: ThemeHit[] = [];
  const impactMap = new Map<string, { score: number; why: string }>();
  const intense = Math.min(countMatches(INTENSE, a.title).length * 0.2 + countMatches(INTENSE, a.summary).length * 0.08, 0.45);
  let severity = 0;

  const add = (symbol: string, score: number, why: string) => {
    const prev = impactMap.get(symbol);
    if (!prev || Math.abs(score) > Math.abs(prev.score)) impactMap.set(symbol, { score: (prev?.score ?? 0) * 0.3 + score, why });
    else prev.score += score * 0.3;
  };

  for (const theme of THEMES) {
    const matched = countMatches(theme.match, text);
    if (!matched.length) continue;
    const inTitle = theme.match.test(a.title);
    const polarity = polarityFor(theme, text, sentiment);
    const themeSeverity = clamp(theme.weight * (inTitle ? 1 : 0.6) + intense, 0, 1);
    severity = Math.max(severity, themeSeverity);
    if (polarity === 0) {
      themes.push({ themeId: theme.id, label: theme.label, geopolitical: theme.geopolitical, polarity: 1, matched: [...new Set(matched)] });
      continue;
    }
    themes.push({ themeId: theme.id, label: theme.label, geopolitical: theme.geopolitical, polarity, matched: [...new Set(matched)] });
    for (const [symbol, weight, why] of theme.impacts) add(symbol, weight * polarity * themeSeverity, why);
  }

  const mentioned = mentionedInstruments(text);
  for (const inst of mentioned) {
    // Company-specific news: the headline's tone matters most.
    // Sector and asset ETFs named in the headline ("defense stocks rally") take its tone,
    // unless a theme has already decided how the story moves them.
    if (inst.cls === "etf" && Math.abs(sentiment) > 0.2 && !impactMap.has(inst.symbol) && (inst.aliases ?? []).some((al) => new RegExp(`\\b${al}\\b`, "i").test(a.title))) {
      add(inst.symbol, sentiment * 0.6 * Math.max(severity, 0.5), sentiment > 0 ? "Headline is positive for the group" : "Headline is negative for the group");
    }
    if (inst.cls === "stock" && Math.abs(sentiment) > 0.05) {
      add(inst.symbol, sentiment * 0.9 * Math.max(severity, 0.6), sentiment > 0 ? "Positive company-specific headline" : "Negative company-specific headline");
      severity = Math.max(severity, 0.55 + intense / 2);
    }
  }

  const regions = REGION_WORDS.filter(([, re]) => re.test(text)).map(([r]) => r);

  return {
    ...a,
    themes,
    sentiment,
    severity: themes.length || mentioned.length ? severity : 0.15,
    tickers: mentioned.map((i) => i.symbol),
    impacts: [...impactMap.entries()]
      .map(([symbol, v]) => ({ symbol, score: Math.round(v.score * 1000) / 1000, why: v.why }))
      .sort((x, y) => Math.abs(y.score) - Math.abs(x.score)),
    regions,
  };
}

/** News older than a day and a half counts for much less. */
export function recencyWeight(published: number, now = Date.now()): number {
  const hours = Math.max(0, (now - published) / 3.6e6);
  return Math.exp(-hours / 36);
}

function geoLabel(i: number): GeoRisk["label"] {
  if (i >= 80) return "Severe";
  if (i >= 60) return "High";
  if (i >= 40) return "Elevated";
  if (i >= 20) return "Guarded";
  return "Calm";
}

export function buildDigest(
  raw: Article[],
  sources: NewsDigest["sources"],
  sample: boolean,
  now = Date.now(),
): NewsDigest {
  // De-duplicate near-identical headlines that several services carry.
  const seen = new Set<string>();
  const unique = raw
    .filter((a) => {
      const key = a.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((x) => x.length > 3).slice(0, 7).join(" ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.published - a.published)
    .slice(0, 250);

  const articles = unique.map(analyzeArticle);

  const themes: ThemeSummary[] = THEMES.map((t) => {
    const hits = articles.filter((a) => a.themes.some((h) => h.themeId === t.id));
    let heatSum = 0;
    let pol = 0;
    const impactAgg = new Map<string, number>();
    for (const a of hits) {
      const rw = recencyWeight(a.published, now);
      heatSum += a.severity * rw;
      const hit = a.themes.find((h) => h.themeId === t.id)!;
      pol += hit.polarity * rw;
      for (const [sym, weight] of t.impacts) impactAgg.set(sym, (impactAgg.get(sym) ?? 0) + weight * hit.polarity * a.severity * rw);
    }
    return {
      themeId: t.id,
      label: t.label,
      geopolitical: t.geopolitical,
      articles: hits.length,
      heat: Math.round(100 * (1 - Math.exp(-heatSum / 2.5))),
      netPolarity: hits.length ? clamp(pol / hits.length, -1, 1) : 0,
      topImpacts: [...impactAgg.entries()]
        .map(([symbol, score]) => ({ symbol, score: Math.round(score * 100) / 100 }))
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
        .slice(0, 6),
      headlines: hits.slice(0, 5).map((a) => ({ title: a.title, source: a.sourceName, url: a.url })),
      explainer: t.explainer,
    };
  })
    .filter((t) => t.articles > 0)
    .sort((a, b) => b.heat - a.heat);

  // Geopolitical risk index: recency-weighted severity of geopolitical stories, with escalation
  // stories counting fully and de-escalation stories counting a quarter.
  let geoSum = 0;
  const regionHeat = new Map<string, number>();
  for (const a of articles) {
    const geo = a.themes.filter((h) => h.geopolitical);
    if (!geo.length) continue;
    const esc = geo.some((h) => h.polarity === 1) ? 1 : 0.25;
    const v = a.severity * recencyWeight(a.published, now) * esc;
    geoSum += v;
    for (const r of a.regions) regionHeat.set(r, (regionHeat.get(r) ?? 0) + v);
  }
  const index = Math.round(100 * (1 - Math.exp(-geoSum / 5)));
  const geoRisk: GeoRisk = {
    index,
    label: geoLabel(index),
    drivers: themes.filter((t) => t.geopolitical).slice(0, 5).map((t) => ({ label: t.label, heat: t.heat })),
    regions: [...regionHeat.entries()]
      .map(([region, v]) => ({ region, heat: Math.round(100 * (1 - Math.exp(-v / 1.5))) }))
      .sort((a, b) => b.heat - a.heat),
  };

  const sentWeights = articles.map((a) => recencyWeight(a.published, now));
  const sentTotal = sentWeights.reduce((s, x) => s + x, 0) || 1;
  const sentiment = articles.reduce((s, a, i) => s + a.sentiment * sentWeights[i], 0) / sentTotal;

  return { articles, themes, geoRisk, sentiment: Math.round(sentiment * 100) / 100, sources, sample, fetchedAt: now };
}

export interface NewsExposure {
  score: number; // -100..100
  contributions: { title: string; source: string; url: string | null; score: number; why: string; published: number }[];
}

/**
 * How the current news flow leans for one instrument: direct impacts count fully, its sector
 * ETF's impacts count 60%, and market-wide (SPY) impacts pass through scaled by beta.
 */
export function newsExposure(symbol: string, digest: NewsDigest, now = Date.now()): NewsExposure {
  const inst = findInstrument(symbol);
  const self = INDEX_PROXY[symbol] ?? symbol;
  const sector = inst ? SECTOR_PROXY[inst.sector] : undefined;
  const beta = inst?.beta ?? 1;
  const links: [string, number][] = [[symbol, 1]];
  if (self !== symbol) links.push([self, 1]);
  if (sector && sector !== self) links.push([sector, 0.6]);
  if (self !== "SPY" && symbol !== "^VIX" && inst?.sector !== "Bonds" && inst?.sector !== "Commodities") links.push(["SPY", 0.4 * beta]);

  let total = 0;
  const contributions: NewsExposure["contributions"] = [];
  for (const a of digest.articles) {
    let s = 0;
    let why = "";
    for (const [sym, k] of links) {
      const hit = a.impacts.find((i) => i.symbol === sym);
      if (hit) {
        s += hit.score * k;
        if (!why || sym === symbol || sym === self) why = sym === symbol || sym === self ? hit.why : `${hit.why} (via ${sym})`;
      }
    }
    if (!s) continue;
    const rw = recencyWeight(a.published, now);
    total += s * rw;
    contributions.push({ title: a.title, source: a.sourceName, url: a.url, score: Math.round(s * rw * 100) / 100, why, published: a.published });
  }
  contributions.sort((x, y) => Math.abs(y.score) - Math.abs(x.score));
  return { score: Math.round(100 * Math.tanh(total / 2.2)), contributions: contributions.slice(0, 12) };
}
