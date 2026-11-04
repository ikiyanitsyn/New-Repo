"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DebateEvent, DebateVerdict, Instrument, Outlook, TradeIdea } from "@/lib/types";
import { PERSONAS, DEFAULT_PANEL } from "@/lib/advisors/personas";
import { useNdjson } from "@/lib/client/hooks";
import { addJournal } from "@/lib/client/portfolio";
import { displaySymbol, fmtPrice, symbolHref } from "@/lib/client/format";
import { Card, StanceChip } from "./ui";

type Ev = Omit<DebateEvent, "type"> & { type: DebateEvent["type"] | "context"; outlook?: Outlook; instrument?: Instrument; last?: number; source?: string };

interface Turn {
  advisorId: string;
  round: number;
  text: string;
  stance?: number;
  done: boolean;
}

const ACTIONS: [TradeIdea["action"], string][] = [
  ["buy", "Buy shares"],
  ["dca", "Dollar-cost average in"],
  ["sell", "Sell / take profits"],
  ["short", "Short sell"],
  ["buy-calls", "Buy call options"],
  ["buy-puts", "Buy put options"],
  ["margin-buy", "Buy on margin"],
  ["hold", "Keep holding"],
];

const PRESETS: { label: string; trade: Partial<TradeIdea> }[] = [
  { label: "NVDA calls before earnings", trade: { symbol: "NVDA", action: "buy-calls", amount: 5000, horizon: "weeks", thesis: "AI data-center demand is still accelerating; I think the next earnings report beats and the stock rips.", portfolioPct: 8 } },
  { label: "Gold as a war hedge", trade: { symbol: "GLD", action: "buy", amount: 10000, horizon: "months", thesis: "Middle East and Russia tensions plus central-bank buying should keep gold rising.", portfolioPct: 10 } },
  { label: "Oil stocks on Middle East escalation", trade: { symbol: "XLE", action: "buy", amount: 8000, horizon: "weeks", thesis: "If the Strait of Hormuz is disrupted, crude spikes and energy stocks follow.", portfolioPct: 7 } },
  { label: "Index fund for retirement", trade: { symbol: "VTI", action: "dca", amount: 500, horizon: "years", thesis: "Invest $500 a month in the total market for 25 years and ignore the noise.", portfolioPct: 60, hasEmergencyFund: true, hasDebt: false } },
  { label: "Short Tesla", trade: { symbol: "TSLA", action: "short", amount: 15000, horizon: "weeks", thesis: "Deliveries are slowing and the EV price war is crushing margins.", portfolioPct: 15 } },
  { label: "Margin into chips", trade: { symbol: "SMH", action: "margin-buy", amount: 25000, horizon: "months", thesis: "Semis are the picks and shovels of AI; leverage will multiply the gains.", portfolioPct: 35, hasDebt: true } },
];

const ROUND_TITLE = ["", "Round 1 · Opening statements", "Round 2 · Rebuttals", "Round 3 · Final word & vote"];

function stanceLabel(s: number) {
  return s >= 2 ? "Strongly for" : s === 1 ? "For" : s === 0 ? "Neutral" : s === -1 ? "Against" : "Strongly against";
}

function StanceBadge({ s }: { s: number }) {
  const cls = s > 0 ? "chip-up" : s < 0 ? "chip-down" : "";
  return <span className={`chip ${cls}`}>{s > 0 ? "▲" : s < 0 ? "▼" : "■"} {stanceLabel(s)}</span>;
}

function Avatar({ id, size = 40 }: { id: string; size?: number }) {
  const p = PERSONAS.find((x) => x.id === id)!;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: p.color, fontSize: size * 0.36 }}
      aria-hidden
    >
      {p.initials}
    </span>
  );
}

function ConsensusMeter({ score }: { score: number }) {
  const pct = ((score + 2) / 4) * 100;
  return (
    <div>
      <div className="relative h-3 rounded-full" style={{ background: "linear-gradient(90deg, var(--down-fill), var(--neutral-mid) 50%, var(--up-fill))" }} aria-hidden>
        <div className="absolute -top-1 h-5 w-1.5 rounded" style={{ left: `calc(${pct}% - 3px)`, background: "var(--ink)" }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] muted">
        <span>Strongly against</span>
        <span>Split</span>
        <span>Strongly for</span>
      </div>
    </div>
  );
}

export default function DebateView({ initialSymbol }: { initialSymbol?: string }) {
  const [trade, setTrade] = useState<TradeIdea>({
    symbol: initialSymbol ?? "NVDA",
    action: "buy",
    amount: 10000,
    horizon: "months",
    thesis: "",
    portfolioPct: 10,
    hasEmergencyFund: true,
    hasDebt: false,
  });
  const [panel, setPanel] = useState<string[]>(DEFAULT_PANEL);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [verdict, setVerdict] = useState<DebateVerdict | null>(null);
  const [mode, setMode] = useState<"ai" | "offline" | null>(null);
  const [ctx, setCtx] = useState<{ outlook: Outlook; instrument: Instrument; last: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { start, stop, running } = useNdjson<Ev>();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (running) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, running]);

  const set = <K extends keyof TradeIdea>(k: K, v: TradeIdea[K]) => setTrade((t) => ({ ...t, [k]: v }));

  function togglePanel(id: string) {
    setPanel((p) => (p.includes(id) ? (p.length > 2 ? p.filter((x) => x !== id) : p) : p.length < 7 ? [...p, id] : p));
  }

  function begin() {
    setTurns([]);
    setVerdict(null);
    setMode(null);
    setCtx(null);
    setNotice(null);
    setSaved(false);
    start("/api/debate", { trade, advisors: panel }, (e) => {
      switch (e.type) {
        case "context":
          if (e.outlook && e.instrument && e.last != null) setCtx({ outlook: e.outlook, instrument: e.instrument, last: e.last });
          break;
        case "meta":
          setMode(e.mode ?? null);
          break;
        case "turn_start":
          setTurns((ts) => [...ts, { advisorId: e.advisorId!, round: e.round!, text: "", done: false }]);
          break;
        case "delta":
          setTurns((ts) => {
            const copy = ts.slice();
            const last = copy[copy.length - 1];
            if (last) copy[copy.length - 1] = { ...last, text: last.text + (e.text ?? "") };
            return copy;
          });
          break;
        case "turn_end":
          setTurns((ts) => {
            const copy = ts.slice();
            const last = copy[copy.length - 1];
            if (last) copy[copy.length - 1] = { ...last, done: true, stance: e.stance };
            return copy;
          });
          break;
        case "verdict":
          setVerdict(e.verdict ?? null);
          break;
        case "error":
          setNotice(e.text ?? "Something went wrong.");
          if (e.text?.includes("Switching")) setTurns([]);
          break;
      }
    });
  }

  function save() {
    if (!verdict || !ctx) return;
    addJournal({ trade, name: ctx.instrument.name, priceAtDebate: ctx.last, verdict, mode: mode ?? "offline" });
    setSaved(true);
  }

  const rounds = [...new Set(turns.map((t) => t.round))];
  const valid = trade.symbol.trim().length > 0 && trade.amount >= 0 && panel.length >= 2;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Advisor Roundtable</h1>
        <p className="max-w-3xl text-sm soft">
          Pitch a trade and watch AI personas modelled on famous investors argue it out over three rounds, using live prices, technicals and the news.
          Then get a moderated verdict. Personas are AI simulations of public investing philosophies, not the real people.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card title="Your trade idea">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.label} className="chip hover:opacity-80" onClick={() => setTrade((t) => ({ ...t, hasEmergencyFund: true, hasDebt: false, ...p.trade }) as TradeIdea)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl" htmlFor="sym">Ticker</label>
                <input id="sym" className="input uppercase" value={trade.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="lbl" htmlFor="amt">Amount ($)</label>
                <input id="amt" className="input num" type="number" min={0} value={trade.amount} onChange={(e) => set("amount", Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                <label className="lbl" htmlFor="act">Action</label>
                <select id="act" className="input" value={trade.action} onChange={(e) => set("action", e.target.value as TradeIdea["action"])}>
                  {ACTIONS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="hz">Holding period</label>
                <select id="hz" className="input" value={trade.horizon} onChange={(e) => set("horizon", e.target.value as TradeIdea["horizon"])}>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="pp">% of portfolio</label>
                <input id="pp" className="input num" type="number" min={0} max={100} value={trade.portfolioPct ?? ""} onChange={(e) => set("portfolioPct", e.target.value === "" ? undefined : Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                <label className="lbl" htmlFor="th">Your thesis: why this trade?</label>
                <textarea id="th" className="input min-h-[84px]" value={trade.thesis} onChange={(e) => set("thesis", e.target.value)} placeholder="e.g. Tariff relief should lift retailers into the holidays…" />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!trade.hasEmergencyFund} onChange={(e) => set("hasEmergencyFund", e.target.checked)} />
                I have a fully funded emergency fund (3–6 months of expenses)
              </label>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!trade.hasDebt} onChange={(e) => set("hasDebt", e.target.checked)} />
                I carry consumer debt (credit cards, car or student loans)
              </label>
            </div>
          </Card>

          <Card title={`The panel (${panel.length} of 7)`}>
            <ul className="space-y-2">
              {PERSONAS.map((p) => {
                const on = panel.includes(p.id);
                return (
                  <li key={p.id}>
                    <button
                      className="flex w-full items-start gap-3 rounded-xl p-2 text-left"
                      style={{ background: on ? "var(--accent-soft)" : "transparent", outline: on ? "1px solid var(--accent)" : "1px solid var(--line)" }}
                      onClick={() => togglePanel(p.id)}
                      aria-pressed={on}
                    >
                      <Avatar id={p.id} size={36} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {p.name} <span className="font-normal soft">· {p.title}</span>
                        </span>
                        <span className="block text-xs soft">{p.tagline}</span>
                      </span>
                      <span className="ml-auto text-sm" aria-hidden>{on ? "✓" : "+"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs muted">Pick 2 to 7 advisors.</p>
          </Card>

          <div className="flex gap-2">
            {running ? (
              <button className="btn w-full" onClick={stop}>■ Stop debate</button>
            ) : (
              <button className="btn btn-primary w-full py-2.5 text-base" onClick={begin} disabled={!valid}>
                ⚖ Start the debate
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {ctx && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <Link href={symbolHref(ctx.instrument.symbol)} className="font-semibold hover:underline">
                    {ctx.instrument.name} ({displaySymbol(ctx.instrument.symbol)})
                  </Link>{" "}
                  <span className="num">{fmtPrice(ctx.last)}</span>
                  <span className="soft"> · MarketMind model for this horizon:</span>
                </div>
                <div className="flex items-center gap-2">
                  <StanceChip stance={ctx.outlook.stance} score={ctx.outlook.score} />
                  {mode && <span className={`chip ${mode === "ai" ? "chip-accent" : ""}`}>{mode === "ai" ? "✦ Live Claude debate" : "◇ Built-in debate engine"}</span>}
                </div>
              </div>
            </Card>
          )}
          {notice && <p className="card p-3 text-sm down">⚠ {notice}</p>}

          {turns.length === 0 && !running && !verdict && (
            <Card>
              <div className="py-10 text-center">
                <div className="mb-3 flex justify-center -space-x-2">
                  {panel.map((id) => (
                    <span key={id} className="rounded-full ring-2" style={{ ["--tw-ring-color" as string]: "var(--surface)" }}>
                      <Avatar id={id} size={44} />
                    </span>
                  ))}
                </div>
                <p className="font-semibold">The panel is ready.</p>
                <p className="mx-auto mt-1 max-w-md text-sm soft">
                  Describe a trade on the left, or tap a preset, and start the debate. Each advisor gives an opening statement, rebuts the panelist they disagree with most, then votes.
                </p>
              </div>
            </Card>
          )}
          {running && turns.length === 0 && (
            <Card>
              <p className="pulse text-sm soft">Pulling prices, technicals and headlines for {trade.symbol}…</p>
            </Card>
          )}

          {rounds.map((r) => (
            <section key={r} className="space-y-3">
              <h2 className="card-h">{ROUND_TITLE[r] ?? `Round ${r}`}</h2>
              {turns
                .filter((t) => t.round === r)
                .map((t, idx) => {
                  const p = PERSONAS.find((x) => x.id === t.advisorId)!;
                  return (
                    <article key={`${t.advisorId}-${r}-${idx}`} className="card flex gap-3 p-4">
                      <Avatar id={p.id} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-xs soft">{p.title}</span>
                          {t.done && t.stance != null && <StanceBadge s={t.stance} />}
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {t.text}
                          {!t.done && <span className="pulse ml-0.5" aria-hidden>▍</span>}
                        </p>
                      </div>
                    </article>
                  );
                })}
            </section>
          ))}
          {running && turns.length > 0 && turns.every((t) => t.done) && !verdict && (
            <p className="pulse text-sm soft">The moderator is weighing the arguments…</p>
          )}

          {verdict && (
            <Card title="Moderator's verdict" right={<span className="chip chip-accent">{verdict.consensus}</span>}>
              <ConsensusMeter score={verdict.score} />
              <p className="mt-3 text-sm leading-relaxed">{verdict.summary}</p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {verdict.votes.map((v) => {
                  const p = PERSONAS.find((x) => x.id === v.advisorId);
                  if (!p) return null;
                  return (
                    <div key={v.advisorId} className="flex items-start gap-2 rounded-xl p-2" style={{ background: "var(--surface-2)" }}>
                      <Avatar id={p.id} size={30} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                          {p.name} <StanceBadge s={v.stance} />
                        </div>
                        <div className="text-xs soft">{v.oneLiner}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-sm font-semibold">Key risks</h3>
                  <ul className="space-y-1 text-sm soft">
                    {verdict.keyRisks.map((r) => (
                      <li key={r} className="flex gap-2"><span aria-hidden className="down">▼</span>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-semibold">Potential catalysts</h3>
                  <ul className="space-y-1 text-sm soft">
                    {verdict.keyCatalysts.length ? verdict.keyCatalysts.map((c) => (
                      <li key={c} className="flex gap-2"><span aria-hidden className="up">▲</span>{c}</li>
                    )) : <li>None the panel found convincing.</li>}
                  </ul>
                </div>
              </div>
              <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: "var(--accent-soft)" }}>
                <span className="font-semibold">Safer way to pursue the same goal: </span>
                {verdict.saferAlternative}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn" onClick={save} disabled={saved}>{saved ? "✓ Saved to journal" : "Save to trade journal"}</button>
                <Link className="btn" href={symbolHref(trade.symbol)}>Open {trade.symbol} analysis</Link>
                <button className="btn" onClick={begin}>Run it again</button>
              </div>
            </Card>
          )}
          <div ref={bottom} />
        </div>
      </div>
    </div>
  );
}
