import type { NewsDigest, Outlook, TradeIdea } from "../types";
import type { SymbolReport } from "../analysis/report";
import type { Persona } from "../advisors/personas";
import { describeAction } from "../advisors/personas";
import { NEWS_SOURCES } from "../news/sources";
import { TREND_LABEL } from "../market/indicators";

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;
const n2 = (x: number | null | undefined) => (x == null ? "n/a" : x.toFixed(2));

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function symbolContext(r: SymbolReport): string {
  const { quote, outlooks, news, digest } = r;
  const t = quote.technicals;
  const i = quote.instrument;
  const o = outlooks[1];
  return [
    `Instrument: ${i.name} (${i.symbol}), ${i.cls}, sector ${i.sector}, region ${i.region}.`,
    `Price data source: ${quote.source}${quote.source === "sample" ? " (ILLUSTRATIVE SAMPLE, not live)" : ""}.`,
    `Last ${n2(t.last)} | 1d ${pct(t.change1d)} | 5d ${pct(t.change5d)} | 1m ${pct(t.change1m)} | 3m ${pct(t.change3m)} | YTD ${pct(t.changeYtd)} | 1y ${pct(t.change1y)}`,
    `SMA20 ${n2(t.sma20)} | SMA50 ${n2(t.sma50)} | SMA200 ${n2(t.sma200)} | RSI14 ${n2(t.rsi14)} | MACD hist ${n2(t.macd?.hist)} | ATR14 ${n2(t.atr14)} | vol ${(t.volAnnual * 100).toFixed(0)}% ann.`,
    `52w range ${n2(t.low52)}–${n2(t.high52)} | support ${n2(t.support)} | resistance ${n2(t.resistance)} | trend: ${TREND_LABEL[t.trend]} (score ${t.trendScore})`,
    t.signals.length ? `Signals: ${t.signals.join("; ")}` : "",
    `MarketMind model (1 month): ${o.stance}, score ${o.score}, P(up) ${(o.probUp * 100).toFixed(0)}%, 1σ move ±${(o.expectedMove * 100).toFixed(1)}%, technical ${o.technicalScore}, news ${o.newsScore}.`,
    `Geopolitical risk index ${digest.geoRisk.index}/100 (${digest.geoRisk.label}); top drivers: ${digest.geoRisk.drivers.map((d) => `${d.label} ${d.heat}`).join(", ") || "none"}.`,
    news.contributions.length
      ? `Headlines scored as moving this instrument:\n${news.contributions.slice(0, 8).map((c) => `- [${c.source}] ${c.title} (impact ${c.score > 0 ? "+" : ""}${c.score}; ${c.why})`).join("\n")}`
      : "No scored headlines touch this instrument directly.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function marketContext(digest: NewsDigest, quotes: { symbol: string; name: string; last: number; d1: number; m1: number; trend: string }[]): string {
  return [
    `Data note: ${digest.sample ? "news below is ILLUSTRATIVE SAMPLE (live feeds unreachable)" : "live headlines from the five services"}.`,
    `Market snapshot:\n${quotes.map((q) => `- ${q.name} (${q.symbol}) ${q.last.toFixed(2)}, 1d ${pct(q.d1)}, 1m ${pct(q.m1)}, ${q.trend}`).join("\n")}`,
    `Geopolitical risk index ${digest.geoRisk.index}/100 (${digest.geoRisk.label}).`,
    `Hottest themes:\n${digest.themes.slice(0, 8).map((t) => `- ${t.label}: heat ${t.heat}, ${t.articles} stories, net ${t.netPolarity > 0 ? "escalating/positive" : "easing/negative"}; top impacts ${t.topImpacts.slice(0, 4).map((i) => `${i.symbol} ${i.score > 0 ? "+" : ""}${i.score}`).join(", ")}`).join("\n")}`,
    `Most severe headlines:\n${[...digest.articles].sort((a, b) => b.severity - a.severity).slice(0, 12).map((a) => `- [${a.sourceName}] ${a.title}`).join("\n")}`,
  ].join("\n\n");
}

const SOURCES_LINE = NEWS_SOURCES.map((s) => s.name).join(", ");

export const RESEARCH_SYSTEM = `You are the head of research at MarketMind, a market-intelligence app. You write speculative, evidence-based outlooks for stocks, ETFs and indexes, with particular attention to how geopolitical and macroeconomic news is likely to move prices.

Research method:
- Use web search to find the most recent relevant reporting (prioritise the last 7 days) from the five services MarketMind follows: ${SOURCES_LINE}. Search only those services. Run several targeted searches: the instrument itself, its sector, and the geopolitical or macro themes in the context.
- Combine what you find with the quantitative context provided (technicals, MarketMind's model score, scored headlines). Where your reading of the news disagrees with the model, say so and explain why.
- For each important event, trace the transmission channel to price (e.g. "Strait of Hormuz risk → crude supply premium → energy margins up, airline fuel costs up").
- Be explicit about uncertainty and give probabilities as ranges. This is speculation for education, not personal financial advice.

Format your answer in Markdown with exactly these sections:
## Bottom line
(2–3 sentences with a directional lean, horizon and confidence)
## What's moving it
## Geopolitical & macro watch
## Bull case / Bear case
## Key levels & upcoming catalysts
## What would change this view
Cite sources inline as [Publisher](url). Keep it under about 650 words.`;

export function researchPrompt(context: string, focus?: string) {
  return `Today is ${today()}.\n\n${context}\n\n${focus ? `The user's specific question: ${focus}\n\n` : ""}Write the research brief.`;
}

export const MARKET_BRIEF_FOCUS =
  "Write today's top-down market brief instead of a single-instrument brief: overall direction for US indexes, the three geopolitical or macro stories most likely to move markets this week and which sectors and ETFs they favour or hurt, plus what to watch.";

// ---- Debate ----

export function tradeDescription(trade: TradeIdea, name: string) {
  return [
    `Proposed trade: ${describeAction(trade, { symbol: trade.symbol, name, cls: "stock", sector: "Broad Market", region: "US" })}, $${trade.amount.toLocaleString("en-US")}, intended holding period: ${trade.horizon}.`,
    trade.portfolioPct != null ? `This would be about ${trade.portfolioPct}% of the investor's portfolio.` : "",
    trade.hasEmergencyFund != null ? `Investor has a fully funded emergency fund: ${trade.hasEmergencyFund ? "yes" : "no"}.` : "",
    trade.hasDebt != null ? `Investor has consumer debt (credit cards, car loans, student loans): ${trade.hasDebt ? "yes" : "no"}.` : "",
    `Investor's thesis: "${trade.thesis || "(none given)"}"`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function personaSystem(p: Persona) {
  return `You are taking part in "The Roundtable", an educational debate feature in the MarketMind app. You play an AI simulation of ${p.name}, based on their publicly known investing philosophy. You are not the real ${p.name}, you are not endorsed by them, and you never claim to have said anything specific in real life. Don't invent quotes, statistics or events.

Their philosophy:
${p.philosophy.map((x) => `- ${x}`).join("\n")}

Voice and style: ${p.voice}

Debate rules:
- Stay in character and argue from this philosophy, applied honestly to the specific trade and market data you are given. Use the numbers.
- Speak conversationally, in first person, as if on a panel. No headings, bullet lists or markdown. 70–150 words.
- When rebutting, address the other panelists by name and engage with what they actually said.
- This is education and entertainment, not personal advice. Don't add disclaimers; the app shows them.`;
}

export function roundInstruction(round: number, name: string) {
  if (round === 1) return `Round 1, opening statement. ${name}, give your take on this trade.`;
  if (round === 2) return `Round 2, rebuttals. ${name}, respond directly to the panelist you disagree with most, by name. Push back on their strongest point, or concede what they got right.`;
  return `Round 3, final word. ${name}, give a 1–2 sentence closing, then end with exactly one line in the form "Vote: Strongly for" / "Vote: For" / "Vote: Neutral" / "Vote: Against" / "Vote: Strongly against".`;
}

export function debateContextBlock(trade: TradeIdea, name: string, ctx: string) {
  return `${tradeDescription(trade, name)}\n\nMarket data and news (from MarketMind):\n${ctx}`;
}

export const MODERATOR_SYSTEM = `You are the neutral moderator of MarketMind's advisor roundtable. Read the debate transcript and produce a fair verdict.
- votes: one entry per panelist, using their advisorId exactly as given. stance is an integer from -2 (strongly against) to 2 (strongly for), based on their stated vote. oneLiner is a fair summary of their position, under 15 words.
- consensus reflects the votes.
- keyRisks and keyCatalysts: 3–5 concrete items each, drawn from the debate and the data.
- saferAlternative: one practical lower-risk way to pursue the same goal.
- summary: 2–3 sentences, balanced.`;

export function outlookLine(o: Outlook) {
  return `${o.stance} (score ${o.score}, P(up) ${(o.probUp * 100).toFixed(0)}%)`;
}

// ---- Offline research brief (no API key) ----

export function offlineBrief(r: SymbolReport): string {
  const { quote, outlooks, news, digest } = r;
  const t = quote.technicals;
  const i = quote.instrument;
  const [w, m, q] = outlooks;
  const lines: string[] = [];
  lines.push(`## Bottom line`);
  lines.push(
    `${i.name} reads **${m.stance.toLowerCase()}** over the next month (model score ${m.score > 0 ? "+" : ""}${m.score}, ${(m.probUp * 100).toFixed(0)}% chance of finishing higher, confidence ${(m.confidence * 100).toFixed(0)}%). One week: ${outlookLine(w)}. One quarter: ${outlookLine(q)}.`,
  );
  lines.push(`## What's moving it`);
  lines.push(`- **Trend:** ${TREND_LABEL[t.trend]}. Price ${t.last.toFixed(2)} vs 50-day ${t.sma50?.toFixed(2) ?? "n/a"} and 200-day ${t.sma200?.toFixed(2) ?? "n/a"}; ${pct(t.change1m)} over a month, ${pct(t.changeYtd)} year to date.`);
  if (t.rsi14 != null) lines.push(`- **Momentum:** RSI ${t.rsi14.toFixed(0)}${t.rsi14 > 70 ? " (overbought)" : t.rsi14 < 30 ? " (oversold)" : ""}; MACD ${t.macd && t.macd.hist > 0 ? "positive" : "negative"}.`);
  for (const s of t.signals.slice(0, 3)) lines.push(`- ${s}.`);
  for (const c of news.contributions.slice(0, 4)) lines.push(`- **${c.source}:** ${c.url ? `[${c.title}](${c.url})` : c.title}. ${c.why} (${c.score > 0 ? "tailwind" : "headwind"}).`);
  lines.push(`## Geopolitical & macro watch`);
  lines.push(`Geopolitical risk index **${digest.geoRisk.index}/100 (${digest.geoRisk.label})**.`);
  for (const d of digest.geoRisk.drivers.slice(0, 4)) lines.push(`- ${d.label}: heat ${d.heat}/100`);
  lines.push(`## Bull case / Bear case`);
  for (const s of m.scenarios) lines.push(`- **${s.name} (${(s.probability * 100).toFixed(0)}%):** ${s.target.toFixed(2)} (${pct(s.move)}). ${s.narrative}`);
  lines.push(`## Key levels & upcoming catalysts`);
  lines.push(`- Support ${t.support?.toFixed(2) ?? "n/a"} · Resistance ${t.resistance?.toFixed(2) ?? "n/a"} · 52-week range ${t.low52.toFixed(2)}–${t.high52.toFixed(2)}`);
  lines.push(`- Typical one-month move: ±${(m.expectedMove * 100).toFixed(1)}%`);
  lines.push(`## What would change this view`);
  lines.push(
    m.score >= 0
      ? `A close below ${(t.support ?? t.sma50 ?? t.last * 0.95).toFixed(2)}, or an escalation in the top geopolitical theme, would flip the setup bearish.`
      : `A close above ${(t.resistance ?? t.sma50 ?? t.last * 1.05).toFixed(2)}, or a de-escalation in the headlines weighing on it, would flip the setup bullish.`,
  );
  lines.push(`\n*This brief came from MarketMind's built-in engine. Add an ANTHROPIC_API_KEY to get Claude's deep research with live web search across ${SOURCES_LINE}.*`);
  return lines.join("\n");
}
