import type { DebateEvent, DebateVerdict, TradeIdea } from "../types";
import { PERSONAS, describeAction, features, type Evaluation, type Persona, type TradeContext } from "./personas";

export function consensusOf(score: number): DebateVerdict["consensus"] {
  if (score >= 1.2) return "Strongly For";
  if (score >= 0.4) return "Lean For";
  if (score <= -1.2) return "Strongly Against";
  if (score <= -0.4) return "Lean Against";
  return "Split";
}

export function saferAlternative(trade: TradeIdea, ctx: TradeContext): string {
  const f = features(ctx);
  if (f.hasDebt) return "Put this money toward your highest-interest debt first; that's a guaranteed return. Revisit the trade once you're debt-free with an emergency fund.";
  if (f.noEmergency) return "Build 3–6 months of expenses in a high-yield savings account first, then invest the rest.";
  if (f.leveraged || trade.action === "short")
    return `Express the view without leverage: a small cash position in ${ctx.inst.symbol}${f.options ? " shares instead of options" : ""}, sized at no more than 2–5% of the portfolio with a predefined exit.`;
  if (f.crypto) return "Cap crypto at a small slice (≤5%) of a portfolio built on broad index funds.";
  if (f.singleStock) return `Keep the core in a broad, low-cost fund (VTI or SPY) and hold ${ctx.inst.symbol} as a satellite position of no more than 5–10%.`;
  if (f.shortTerm) return "Lengthen the horizon to five years or more, and add gradually (dollar-cost averaging) rather than all at once.";
  return "Add it gradually with dollar-cost averaging, and rebalance once a year.";
}

const REBUT_OPEN: Record<string, (opp: string) => string> = {
  ramsey: (o) => `Hey, ${o} is a smart person, but smart people do dumb things with money all the time.`,
  buffett: (o) => `I have great respect for ${o}, but Charlie would say: invert, always invert.`,
  wood: (o) => `With respect to ${o}, that view is anchored in the past.`,
  dalio: (o) => `I want to stress-test what ${o} said, because believability matters.`,
  orman: (o) => `${o}, I hear you, but let me ask the person listening a different question.`,
  cramer: (o) => `${o}, come on! I love you, but you're missing the action here!`,
  lynch: (o) => `${o} makes a fair point, but here's what I'd want to know.`,
};

function chunk(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

function snippet(s: string, words = 14) {
  const w = s.split(/\s+/);
  return w.length <= words ? s : w.slice(0, words).join(" ") + "…";
}

export function offlineVerdict(ctx: TradeContext, evals: Map<string, Evaluation>, panel: Persona[]): DebateVerdict {
  const votes = panel.map((p) => ({ advisorId: p.id, stance: evals.get(p.id)!.stance, oneLiner: evals.get(p.id)!.oneLiner }));
  const score = votes.reduce((s, v) => s + v.stance, 0) / Math.max(votes.length, 1);
  const risks = [...new Set(panel.filter((p) => evals.get(p.id)!.stance <= 0).map((p) => evals.get(p.id)!.risk))];
  const bear = ctx.outlook.scenarios.find((s) => s.name === "Bear");
  if (bear) risks.push(`Model bear case: ${(bear.move * 100).toFixed(1)}% to ${bear.target.toFixed(2)} (${(bear.probability * 100).toFixed(0)}% probability)`);
  const catalysts = [...new Set(panel.map((p) => evals.get(p.id)!.catalyst).filter(Boolean) as string[])];
  for (const d of ctx.outlook.drivers.filter((d) => d.impact > 0).slice(0, 2)) catalysts.push(d.label);
  const consensus = consensusOf(score);
  const forN = votes.filter((v) => v.stance > 0).length;
  const againstN = votes.filter((v) => v.stance < 0).length;
  return {
    consensus,
    score: Math.round(score * 100) / 100,
    votes,
    keyRisks: risks.slice(0, 5),
    keyCatalysts: catalysts.slice(0, 4),
    saferAlternative: saferAlternative(ctx.trade, ctx),
    summary: `${forN} for, ${againstN} against, ${votes.length - forN - againstN} neutral. The panel is ${consensus.toLowerCase()} on ${describeAction(ctx.trade, ctx.inst)}. MarketMind's own model reads ${ctx.outlook.stance.toLowerCase()} (${(ctx.outlook.probUp * 100).toFixed(0)}% chance of finishing higher over ${ctx.outlook.horizonDays} trading days).`,
  };
}

/**
 * The built-in debate engine: three rounds (opening, rebuttal, final vote) generated from each
 * persona's rules and the live market context. Used when no Claude API key is configured.
 */
export async function* offlineDebate(ctx: TradeContext, advisorIds: string[], pace = 18): AsyncGenerator<DebateEvent> {
  const panel = advisorIds.map((id) => PERSONAS.find((p) => p.id === id)).filter(Boolean) as Persona[];
  const evals = new Map(panel.map((p) => [p.id, p.evaluate(ctx)]));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  yield { type: "meta", mode: "offline" };

  async function* speak(p: Persona, round: number, text: string, stance?: number): AsyncGenerator<DebateEvent> {
    yield { type: "turn_start", advisorId: p.id, round };
    for (const c of chunk(text)) {
      yield { type: "delta", advisorId: p.id, round, text: c };
      if (pace) await sleep(pace);
    }
    yield { type: "turn_end", advisorId: p.id, round, stance };
  }

  // Round 1: opening statements
  for (const p of panel) {
    const e = evals.get(p.id)!;
    yield* speak(p, 1, e.points.join(" "), e.stance);
  }

  // Round 2: each advisor rebuts the panelist they disagree with most
  for (const p of panel) {
    const mine = evals.get(p.id)!;
    let opp: Persona | undefined;
    let gap = -1;
    for (const q of panel) {
      if (q.id === p.id) continue;
      const d = Math.abs(evals.get(q.id)!.stance - mine.stance);
      if (d > gap) {
        gap = d;
        opp = q;
      }
    }
    if (!opp) continue;
    const theirs = evals.get(opp.id)!;
    const open = REBUT_OPEN[p.id]?.(opp.name) ?? `${opp.name}, I see it differently.`;
    let body: string;
    if (gap === 0) {
      body = `We actually agree here. ${opp.name} said "${snippet(theirs.points[0])}", and I'd add one thing: the biggest risk is ${mine.risk.toLowerCase()}.`;
    } else if (theirs.stance > mine.stance) {
      body = `When you say "${snippet(theirs.points[0])}", you're glossing over the real risk: ${mine.risk.toLowerCase()}. ${p.philosophy[p.philosophy.length - 1]}`;
    } else {
      body = `You're focused on the risk (${theirs.risk.charAt(0).toLowerCase()}${theirs.risk.slice(1)}), and that's fair, but ${mine.catalyst ? `you're missing the catalyst: ${mine.catalyst}.` : `the bigger picture is this: ${p.philosophy[0].charAt(0).toLowerCase()}${p.philosophy[0].slice(1)}`}`;
    }
    yield* speak(p, 2, `${open} ${body}`);
  }

  // Round 3: final word and vote
  for (const p of panel) {
    const e = evals.get(p.id)!;
    const label = e.stance >= 2 ? "Strongly for" : e.stance === 1 ? "For" : e.stance === 0 ? "Neutral" : e.stance === -1 ? "Against" : "Strongly against";
    yield* speak(p, 3, `${e.oneLiner} My vote: ${label}.`, e.stance);
  }

  yield { type: "verdict", verdict: offlineVerdict(ctx, evals, panel) };
  yield { type: "done" };
}
