import { z } from "zod";
import { ndjson } from "@/lib/stream";
import { aiEnabled, streamClaude } from "@/lib/ai/claude";
import { MARKET_BRIEF_FOCUS, RESEARCH_SYSTEM, marketContext, offlineBrief, researchPrompt, symbolContext } from "@/lib/ai/prompts";
import { symbolReport } from "@/lib/analysis/report";
import { getNewsDigest } from "@/lib/news/service";
import { getQuotes } from "@/lib/market/service";
import { normalizeSymbol } from "@/lib/universe";
import { TREND_LABEL } from "@/lib/market/indicators";

const Body = z.object({ symbol: z.string().max(16).optional(), focus: z.string().max(600).optional() });

async function marketBriefContext() {
  const digest = await getNewsDigest();
  const quotes = await getQuotes(["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX", "TLT", "GLD", "USO", "UUP", "IBIT"]);
  return {
    digest,
    text: marketContext(
      digest,
      quotes.map((q) => ({ symbol: q.instrument.symbol, name: q.instrument.name, last: q.technicals.last, d1: q.technicals.change1d, m1: q.technicals.change1m, trend: TREND_LABEL[q.technicals.trend] })),
    ),
  };
}

function offlineMarketBrief(digest: Awaited<ReturnType<typeof getNewsDigest>>, ctx: string) {
  const lines = ["## Bottom line", `Geopolitical risk is **${digest.geoRisk.label.toLowerCase()} (${digest.geoRisk.index}/100)** and headline sentiment is ${digest.sentiment > 0.05 ? "positive" : digest.sentiment < -0.05 ? "negative" : "mixed"} (${digest.sentiment}).`, "## What's moving markets"];
  for (const t of digest.themes.slice(0, 5)) {
    lines.push(`- **${t.label}** (heat ${t.heat}, ${t.articles} stories): ${t.explainer} Most affected: ${t.topImpacts.slice(0, 4).map((i) => `${i.symbol} ${i.score > 0 ? "▲" : "▼"}`).join(", ")}.`);
  }
  lines.push("## Snapshot", ...ctx.split("\n").filter((l) => l.startsWith("- ") && l.includes("1d")).slice(0, 10));
  lines.push("\n*This brief came from MarketMind's built-in engine. Add an ANTHROPIC_API_KEY for Claude's deep research with live web search.*");
  return lines.join("\n");
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const symbol = parsed.data.symbol ? normalizeSymbol(parsed.data.symbol) : null;
  const focus = parsed.data.focus?.trim();

  return ndjson(async (send, signal) => {
    send({ type: "status", text: "Gathering prices, technicals and headlines…" });
    let context: string;
    let fallback: () => string;
    if (symbol) {
      const report = await symbolReport(symbol);
      context = symbolContext(report);
      fallback = () => offlineBrief(report);
    } else {
      const m = await marketBriefContext();
      context = m.text;
      fallback = () => offlineMarketBrief(m.digest, m.text);
    }

    if (!aiEnabled()) {
      send({ type: "meta", mode: "offline" });
      for (const piece of fallback().match(/[^\n]*\n?/g) ?? []) if (piece) send({ type: "text", text: piece });
      send({ type: "done" });
      return;
    }

    send({ type: "meta", mode: "ai" });
    send({ type: "status", text: "Claude is researching Bloomberg, Reuters, WSJ, CNBC and Yahoo Finance…" });
    try {
      await streamClaude({
        system: RESEARCH_SYSTEM,
        prompt: researchPrompt(context, symbol ? focus : [MARKET_BRIEF_FOCUS, focus].filter(Boolean).join(" ")),
        effort: "high",
        webSearch: true,
        maxTokens: 32000,
        signal,
        onText: (text) => send({ type: "text", text }),
        onSource: (s) => send({ type: "source", ...s }),
        onStatus: (text) => send({ type: "status", text }),
      });
    } catch (err) {
      send({ type: "error", text: `Claude research failed (${err instanceof Error ? err.message : "unknown error"}). Showing the built-in brief instead.` });
      send({ type: "text", text: "\n\n" + fallback() });
    }
    send({ type: "done" });
  }, request);
}
