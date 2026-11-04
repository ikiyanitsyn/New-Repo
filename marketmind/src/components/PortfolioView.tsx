"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TrendState } from "@/lib/types";
import { useJson } from "@/lib/client/hooks";
import { placeOrder, removeJournal, resetPortfolio, toggleWatch, usePortfolio } from "@/lib/client/portfolio";
import { displaySymbol, fmtMoney, fmtPct, fmtPrice, symbolHref, timeAgo } from "@/lib/client/format";
import { Card, Change, TrendChip } from "./ui";
import Sparkline from "./Sparkline";
import { PERSONAS } from "@/lib/advisors/personas";

interface Q {
  symbol: string;
  name: string;
  last: number;
  d1: number;
  m1: number;
  trend: TrendState;
  spark: number[];
  source: string;
}

const ALLOC_COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export default function PortfolioView() {
  const pf = usePortfolio();
  const symbols = useMemo(() => [...new Set([...Object.keys(pf.positions), ...pf.watchlist, ...pf.journal.map((j) => j.trade.symbol)])], [pf]);
  const { data } = useJson<{ quotes: Q[] }>(symbols.length ? `/api/quotes?symbols=${symbols.map(encodeURIComponent).join(",")}` : null, 60_000);
  const quotes = useMemo(() => new Map((data?.quotes ?? []).map((q) => [q.symbol, q])), [data]);
  const [confirmReset, setConfirmReset] = useState(false);

  const positions = Object.values(pf.positions).map((p) => {
    const q = quotes.get(p.symbol);
    const last = q?.last ?? p.avgCost;
    const value = p.qty * last;
    const boughtToday = !!p.lastBuyAt && new Date(p.lastBuyAt).toDateString() === new Date().toDateString();
    const prevClose = last / (1 + (q?.d1 ?? 0));
    const dayBase = boughtToday ? p.avgCost : prevClose;
    return { ...p, last, value, pnl: value - p.qty * p.avgCost, pnlPct: last / p.avgCost - 1, d1: q?.d1 ?? 0, dayPnl: p.qty * (last - dayBase) };
  });
  const invested = positions.reduce((s, p) => s + p.value, 0);
  const equity = pf.cash + invested;
  const totalPnl = equity - pf.startingCash;
  const dayPnl = positions.reduce((s, p) => s + p.dayPnl, 0);
  const allocation = [...positions].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paper portfolio</h1>
          <p className="text-sm soft">Practise with $100,000 of virtual money. Everything is stored in this browser only.</p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-2 text-sm">
            Reset cash and positions?
            <button className="btn btn-down py-1" onClick={() => { resetPortfolio(); setConfirmReset(false); }}>Reset</button>
            <button className="btn py-1" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn py-1 text-sm" onClick={() => setConfirmReset(true)}>Reset account</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Account value", fmtMoney(equity), null],
          ["Total P&L", fmtMoney(totalPnl), totalPnl / pf.startingCash],
          ["Today", fmtMoney(dayPnl), invested ? dayPnl / invested : 0],
          ["Cash", fmtMoney(pf.cash), null],
        ].map(([label, value, pct]) => (
          <div key={label as string} className="card p-4">
            <div className="text-xs font-semibold muted">{label}</div>
            <div className="num mt-1 text-2xl font-bold">{value}</div>
            {pct != null && <Change value={pct as number} className="text-sm" />}
          </div>
        ))}
      </div>

      <Card title="Positions">
        {positions.length === 0 ? (
          <p className="text-sm soft">
            No positions yet. Open any instrument (for example <Link className="underline" href="/symbol/SPY">SPY</Link>) and use the paper trade ticket.
          </p>
        ) : (
          <>
            <div className="mb-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label="Allocation by position">
              {allocation.map((p, i) => (
                <div key={p.symbol} style={{ width: `${(p.value / equity) * 100}%`, background: ALLOC_COLORS[i % ALLOC_COLORS.length], marginRight: 2 }} title={`${p.symbol} ${((p.value / equity) * 100).toFixed(1)}%`} />
              ))}
              <div style={{ flex: 1, background: "var(--neutral-mid)" }} title={`Cash ${((pf.cash / equity) * 100).toFixed(1)}%`} />
            </div>
            <div className="mb-3 flex flex-wrap gap-3 text-xs soft">
              {allocation.map((p, i) => (
                <span key={p.symbol} className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                  {displaySymbol(p.symbol)} {((p.value / equity) * 100).toFixed(1)}%
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--neutral-mid)" }} />
                Cash {((pf.cash / equity) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl num w-full text-sm">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Qty</th>
                    <th>Avg cost</th>
                    <th>Last</th>
                    <th>Today</th>
                    <th>Value</th>
                    <th>P&L</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol}>
                      <td>
                        <Link href={symbolHref(p.symbol)} className="hover:underline">
                          <span className="font-semibold">{displaySymbol(p.symbol)}</span> <span className="soft">{p.name}</span>
                        </Link>
                      </td>
                      <td>{p.qty}</td>
                      <td>{fmtPrice(p.avgCost)}</td>
                      <td>{fmtPrice(p.last)}</td>
                      <td><Change value={p.d1} /></td>
                      <td>{fmtMoney(p.value)}</td>
                      <td>
                        <span className={p.pnl >= 0 ? "up" : "down"}>{fmtMoney(p.pnl)}</span> <span className="text-xs soft">({fmtPct(p.pnlPct)})</span>
                      </td>
                      <td>
                        <button className="btn py-0.5 text-xs" onClick={() => placeOrder({ symbol: p.symbol, name: p.name, side: "sell", qty: p.qty, price: p.last, note: "Closed from portfolio" })}>
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Watchlist">
          {pf.watchlist.length === 0 ? (
            <p className="text-sm soft">Use ☆ Watch on any instrument page to add it here.</p>
          ) : (
            <ul>
              {pf.watchlist.map((s) => {
                const q = quotes.get(s);
                return (
                  <li key={s} className="flex items-center justify-between gap-2 py-2 text-sm" style={{ borderBottom: "1px solid var(--line)" }}>
                    <Link href={symbolHref(s)} className="min-w-0 truncate hover:underline">
                      <span className="font-semibold">{displaySymbol(s)}</span> <span className="soft">{q?.name}</span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-3">
                      {q && <Sparkline data={q.spark} width={60} height={20} />}
                      <span className="num w-20 text-right">{q ? fmtPrice(q.last) : "…"}</span>
                      {q && <Change value={q.d1} className="w-16 text-right" />}
                      {q && <span className="hidden sm:inline"><TrendChip trend={q.trend} /></span>}
                      <button className="muted hover:opacity-70" onClick={() => toggleWatch(s)} aria-label={`Remove ${s} from watchlist`}>✕</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Order history">
          {pf.fills.length === 0 ? (
            <p className="text-sm soft">No paper trades yet.</p>
          ) : (
            <ul className="max-h-80 overflow-auto text-sm">
              {pf.fills.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                  <span>
                    <span className={`chip ${f.side === "buy" ? "chip-up" : "chip-down"}`}>{f.side.toUpperCase()}</span>{" "}
                    <span className="num">{f.qty}</span> <span className="font-semibold">{displaySymbol(f.symbol)}</span> @ <span className="num">{fmtPrice(f.price)}</span>
                  </span>
                  <span className="text-xs muted">{timeAgo(f.t)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Trade journal · Roundtable verdicts">
        {pf.journal.length === 0 ? (
          <p className="text-sm soft">
            Save a verdict from the <Link className="underline" href="/debate">Advisor Roundtable</Link> to track how the panel&apos;s calls play out.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pf.journal.map((j) => {
              const q = quotes.get(j.trade.symbol);
              const move = q ? q.last / j.priceAtDebate - 1 : null;
              const bearish = ["sell", "short", "buy-puts"].includes(j.trade.action);
              const calledRight = move != null && Math.abs(move) > 0.005 ? (j.verdict.score > 0) === (bearish ? move < 0 : move > 0) : null;
              return (
                <li key={j.id} className="rounded-xl p-3" style={{ border: "1px solid var(--line)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">
                        {j.trade.action.charAt(0).toUpperCase() + j.trade.action.slice(1).replace("-", " ")} {displaySymbol(j.trade.symbol)} · ${j.trade.amount.toLocaleString()} · {j.trade.horizon}
                      </div>
                      <div className="text-xs muted">{new Date(j.t).toLocaleString()} · {j.mode === "ai" ? "Claude debate" : "built-in engine"}</div>
                    </div>
                    <button className="muted hover:opacity-70" onClick={() => removeJournal(j.id)} aria-label="Delete journal entry">✕</button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="chip chip-accent">{j.verdict.consensus}</span>
                    <span className="soft">
                      at {fmtPrice(j.priceAtDebate)} → now {q ? fmtPrice(q.last) : "…"}
                    </span>
                    {move != null && <Change value={move} />}
                    {calledRight != null && <span className={`chip ${calledRight ? "chip-up" : "chip-down"}`}>{calledRight ? "✓ Panel right so far" : "✗ Panel wrong so far"}</span>}
                  </div>
                  <div className="mt-2 flex -space-x-1">
                    {j.verdict.votes.map((v) => {
                      const p = PERSONAS.find((x) => x.id === v.advisorId);
                      return p ? (
                        <span key={v.advisorId} title={`${p.name}: ${v.stance > 0 ? "for" : v.stance < 0 ? "against" : "neutral"}`} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: p.color, outline: `2px solid ${v.stance > 0 ? "var(--up-fill)" : v.stance < 0 ? "var(--down-fill)" : "var(--line-strong)"}` }}>
                          {p.initials}
                        </span>
                      ) : null;
                    })}
                  </div>
                  {j.trade.thesis && <p className="mt-2 text-xs italic soft">&ldquo;{j.trade.thesis}&rdquo;</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
