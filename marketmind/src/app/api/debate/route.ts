import { z } from "zod";
import { ndjson } from "@/lib/stream";
import type { DebateEvent, DebateVerdict } from "@/lib/types";
import { aiEnabled, moderatorVerdict, streamClaude } from "@/lib/ai/claude";
import { MODERATOR_SYSTEM, debateContextBlock, personaSystem, roundInstruction, symbolContext } from "@/lib/ai/prompts";
import { symbolReport } from "@/lib/analysis/report";
import { PERSONAS, type TradeContext } from "@/lib/advisors/personas";
import { consensusOf, offlineDebate, offlineVerdict } from "@/lib/advisors/debate";
import { normalizeSymbol } from "@/lib/universe";

const Body = z.object({
  trade: z.object({
    symbol: z.string().min(1).max(16),
    action: z.enum(["buy", "sell", "short", "buy-calls", "buy-puts", "margin-buy", "dca", "hold"]),
    amount: z.number().min(0).max(1e9),
    horizon: z.enum(["days", "weeks", "months", "years"]),
    thesis: z.string().max(1500).default(""),
    portfolioPct: z.number().min(0).max(100).optional(),
    hasEmergencyFund: z.boolean().optional(),
    hasDebt: z.boolean().optional(),
  }),
  advisors: z.array(z.string()).min(2).max(7),
  rounds: z.number().int().min(1).max(3).default(3),
});

const HORIZON_INDEX = { days: 0, weeks: 1, months: 2, years: 2 } as const;

function parseVote(text: string): number | undefined {
  const m = text.match(/vote:\s*(strongly for|for|neutral|against|strongly against)/i);
  if (!m) return undefined;
  return { "strongly for": 2, for: 1, neutral: 0, against: -1, "strongly against": -2 }[m[1].toLowerCase()];
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid debate request", issues: parsed.error.issues }, { status: 400 });
  const { trade: rawTrade, advisors, rounds } = parsed.data;
  const trade = { ...rawTrade, symbol: normalizeSymbol(rawTrade.symbol) };
  const panel = advisors.map((id) => PERSONAS.find((p) => p.id === id)).filter((p): p is (typeof PERSONAS)[number] => !!p);
  if (panel.length < 2) return Response.json({ error: "Pick at least two advisors" }, { status: 400 });

  return ndjson(async (send, signal) => {
    const report = await symbolReport(trade.symbol);
    const outlook = report.outlooks[HORIZON_INDEX[trade.horizon]];
    const ctx: TradeContext = {
      trade,
      inst: report.quote.instrument,
      t: report.quote.technicals,
      outlook,
      geo: report.digest.geoRisk,
      newsHeadline: report.news.contributions[0]?.title,
      newsScore: report.news.score,
    };
    send({ type: "context", outlook, instrument: report.quote.instrument, last: report.quote.technicals.last, source: report.quote.source });

    const runOffline = async () => {
      for await (const ev of offlineDebate(ctx, panel.map((p) => p.id))) {
        if (signal.aborted) return;
        send(ev);
      }
    };

    if (!aiEnabled()) return runOffline();

    send({ type: "meta", mode: "ai" } satisfies DebateEvent);
    const dataBlock = debateContextBlock(trade, report.quote.instrument.name, symbolContext(report));
    const transcript: { name: string; id: string; round: number; text: string }[] = [];
    const votes = new Map<string, number>();

    try {
      for (let round = 1; round <= rounds; round++) {
        for (const p of panel) {
          if (signal.aborted) return;
          send({ type: "turn_start", advisorId: p.id, round } satisfies DebateEvent);
          const soFar = transcript.length
            ? `\n\nDebate so far:\n${transcript.map((t) => `[Round ${t.round}] ${t.name}: ${t.text}`).join("\n\n")}`
            : "";
          const panelLine = `Panelists: ${panel.map((x) => x.name).join(", ")}.`;
          const { text } = await streamClaude({
            system: personaSystem(p),
            prompt: `${dataBlock}\n\n${panelLine}${soFar}\n\n${roundInstruction(round === rounds ? 3 : round, p.name)}`,
            effort: "low",
            maxTokens: 2000,
            signal,
            onText: (t) => send({ type: "delta", advisorId: p.id, round, text: t } satisfies DebateEvent),
          });
          const vote = parseVote(text);
          if (vote != null) votes.set(p.id, vote);
          transcript.push({ name: p.name, id: p.id, round, text: text.trim() });
          send({ type: "turn_end", advisorId: p.id, round, stance: vote } satisfies DebateEvent);
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      send({ type: "error", text: `Claude is unavailable (${err instanceof Error ? err.message : "unknown error"}). Switching to the built-in debate engine.` });
      return runOffline();
    }

    // Moderator verdict (structured), falling back to the rules engine if needed.
    const evals = new Map(panel.map((p) => [p.id, p.evaluate(ctx)]));
    let verdict: DebateVerdict = offlineVerdict(ctx, evals, panel);
    for (const v of verdict.votes) if (votes.has(v.advisorId)) v.stance = votes.get(v.advisorId)!;
    try {
      const ai = await moderatorVerdict(
        MODERATOR_SYSTEM,
        `${dataBlock}\n\nPanel (advisorId → name): ${panel.map((p) => `${p.id} → ${p.name}`).join(", ")}\n\nTranscript:\n${transcript.map((t) => `[Round ${t.round}] ${t.name} (${t.id}): ${t.text}`).join("\n\n")}`,
      );
      if (ai) {
        const stances = panel.map((p) => votes.get(p.id) ?? ai.votes.find((v) => v.advisorId === p.id)?.stance ?? 0);
        const score = stances.reduce((s, x) => s + x, 0) / stances.length;
        verdict = {
          consensus: consensusOf(score),
          score: Math.round(score * 100) / 100,
          votes: panel.map((p, i) => ({ advisorId: p.id, stance: Math.max(-2, Math.min(2, stances[i])), oneLiner: ai.votes.find((v) => v.advisorId === p.id)?.oneLiner ?? "" })),
          keyRisks: ai.keyRisks,
          keyCatalysts: ai.keyCatalysts,
          saferAlternative: ai.saferAlternative,
          summary: ai.summary,
        };
      }
    } catch {
      // keep the rules-based verdict
    }
    send({ type: "verdict", verdict } satisfies DebateEvent);
    send({ type: "done" } satisfies DebateEvent);
  }, request);
}
