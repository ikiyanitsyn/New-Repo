import type { Driver, GeoRisk, Instrument, Outlook, Scenario, Technicals } from "../types";
import type { NewsExposure } from "./newsImpact";
import { TREND_LABEL } from "../market/indicators";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const HAVENS = new Set(["GLD", "SLV", "TLT", "^VIX", "UUP", "ITA", "LMT", "RTX"]);

export function stanceOf(score: number): Outlook["stance"] {
  if (score >= 40) return "Strong Bullish";
  if (score >= 12) return "Bullish";
  if (score <= -40) return "Strong Bearish";
  if (score <= -12) return "Bearish";
  return "Neutral";
}

function pct(x: number, digits = 1) {
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
}

/**
 * MarketMind's speculative outlook: a weighted blend of the price trend, momentum and
 * mean-reversion signals with the news flow and geopolitical backdrop. News counts most over
 * days, trend most over months. Probabilities are deliberately kept between 20% and 80%:
 * no signal set justifies more certainty than that.
 */
export function buildOutlook(
  inst: Instrument,
  t: Technicals,
  news: NewsExposure,
  geo: GeoRisk,
  horizonDays = 21,
  sampleData = false,
): Outlook {
  const drivers: Driver[] = [];
  const h = horizonDays;
  const wTrend = h <= 5 ? 0.35 : h <= 21 ? 0.55 : 0.75;
  const wNews = h <= 5 ? 0.55 : h <= 21 ? 0.4 : 0.2;

  // --- technical ---
  let tech = t.trendScore * wTrend;
  drivers.push({ label: `${TREND_LABEL[t.trend]} (trend score ${t.trendScore})`, impact: t.trendScore * wTrend, kind: "technical" });

  if (t.rsi14 != null) {
    const mr = h <= 21 ? (t.rsi14 > 72 ? -14 : t.rsi14 > 65 ? -6 : t.rsi14 < 28 ? 14 : t.rsi14 < 35 ? 6 : 0) : 0;
    if (mr) {
      tech += mr;
      drivers.push({ label: `RSI ${t.rsi14.toFixed(0)} ${mr < 0 ? "overbought: mean-reversion risk" : "oversold: rebound potential"}`, impact: mr, kind: "technical" });
    }
  }
  if (t.macd) {
    const m = t.macd.hist > 0 ? 6 : -6;
    tech += m;
    drivers.push({ label: `MACD momentum ${t.macd.hist > 0 ? "positive" : "negative"}`, impact: m, kind: "technical" });
  }
  if (t.bollinger) {
    const b = t.bollinger.pctB > 1.05 ? -6 : t.bollinger.pctB < -0.05 ? 6 : 0;
    if (b) {
      tech += b;
      drivers.push({ label: b < 0 ? "Stretched above upper Bollinger band" : "Washed out below lower Bollinger band", impact: b, kind: "technical" });
    }
  }
  if (t.change1m) {
    const mom = clamp(t.change1m * 100, -10, 10) * (h <= 5 ? 0.6 : 0.4);
    tech += mom;
    drivers.push({ label: `1-month momentum ${pct(t.change1m)}`, impact: mom, kind: "technical" });
  }
  tech = clamp(tech, -100, 100);

  // --- news ---
  const newsScore = news.score;
  const newsPart = newsScore * wNews;
  for (const c of news.contributions.slice(0, 4)) {
    drivers.push({ label: `${c.source}: ${c.title}`, impact: clamp(c.score * 40 * wNews, -30, 30), kind: "news" });
  }

  // --- macro / geopolitical backdrop ---
  let macro = 0;
  if (geo.index >= 40) {
    const beta = inst.beta ?? 1;
    const haven = HAVENS.has(inst.symbol);
    macro = haven ? (geo.index - 40) / 6 : -((geo.index - 40) / 8) * clamp(beta, 0.2, 2);
    drivers.push({
      label: `Geopolitical risk ${geo.label.toLowerCase()} (${geo.index}/100)${haven ? ": supports havens" : ": weighs on risk assets"}`,
      impact: macro,
      kind: "macro",
    });
  }

  const score = Math.round(clamp(tech + newsPart + macro, -100, 100));
  const probUp = clamp(1 / (1 + Math.exp(-score / 45)), 0.2, 0.8);
  const sigma = Math.max(t.volAnnual, 0.05) * Math.sqrt(h / 252);
  const mu = (probUp - 0.5) * 2 * sigma * 0.6;

  // Confidence: signals agreeing, a strong reading, enough data, not wildly volatile.
  const agree = Math.sign(tech) === Math.sign(newsScore) || newsScore === 0 ? 1 : 0.6;
  let confidence = (0.35 + Math.min(Math.abs(score), 60) / 120) * agree;
  if (t.volAnnual > 0.5) confidence *= 0.8;
  if (sampleData) confidence *= 0.6;
  confidence = clamp(confidence, 0.1, 0.85);

  const pBull = clamp(0.25 + (probUp - 0.5) * 0.9, 0.06, 0.6);
  const pBear = clamp(0.25 - (probUp - 0.5) * 0.9, 0.06, 0.6);
  const pBase = 1 - pBull - pBear;
  const last = t.last;
  const horizonLabel = h <= 5 ? "the next week" : h <= 21 ? "the next month" : "the next quarter";
  const topNews = news.contributions[0];
  const worstNews = news.contributions.filter((c) => c.score < 0).sort((a, b) => a.score - b.score)[0];
  const bestNews = news.contributions.filter((c) => c.score > 0).sort((a, b) => b.score - a.score)[0];

  const scenarios: Scenario[] = [
    {
      name: "Bull",
      probability: pBull,
      move: Math.exp(mu + sigma) - 1,
      target: last * Math.exp(mu + sigma),
      narrative:
        t.resistance && t.resistance > last
          ? `Breaks resistance near ${t.resistance.toFixed(2)} as ${bestNews ? `tailwinds like "${bestNews.title.slice(0, 60)}" play out` : "sentiment improves"} and the trend reasserts.`
          : `Extends to fresh highs on ${newsScore > 0 ? "supportive headlines" : "a relief rally"} and momentum buying.`,
    },
    {
      name: "Base",
      probability: pBase,
      move: Math.exp(mu) - 1,
      target: last * Math.exp(mu),
      narrative: `Drifts ${mu >= 0 ? "higher" : "lower"} within a normal range for its volatility (${(t.volAnnual * 100).toFixed(0)}% annualised).`,
    },
    {
      name: "Bear",
      probability: pBear,
      move: Math.exp(mu - sigma) - 1,
      target: last * Math.exp(mu - sigma),
      narrative:
        t.support && t.support < last
          ? `Loses support near ${t.support.toFixed(2)}${worstNews ? ` as headwinds like "${worstNews.title.slice(0, 70)}" weigh` : " on a risk-off turn"}.`
          : `Slides on a risk-off turn${geo.index >= 40 ? " driven by geopolitical stress" : ""}.`,
    },
  ];

  drivers.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const stance = stanceOf(score);
  const summary =
    `${stance} for ${horizonLabel} (score ${score > 0 ? "+" : ""}${score}). ` +
    `The chart is in a ${TREND_LABEL[t.trend].toLowerCase()} ` +
    `and the news flow is ${newsScore > 15 ? "supportive" : newsScore < -15 ? "a headwind" : "roughly neutral"}` +
    `${topNews ? ` (the single biggest story: "${topNews.title.slice(0, 90)}")` : ""}. ` +
    `A typical move over this horizon is about ±${(sigma * 100).toFixed(1)}%, and the model puts the chance of finishing higher at ${(probUp * 100).toFixed(0)}%.`;

  return {
    symbol: inst.symbol,
    horizonDays: h,
    score,
    stance,
    probUp,
    expectedMove: sigma,
    confidence,
    technicalScore: Math.round(tech),
    newsScore,
    drivers: drivers.slice(0, 9).map((d) => ({ ...d, impact: Math.round(d.impact * 10) / 10 })),
    scenarios,
    summary,
  };
}
