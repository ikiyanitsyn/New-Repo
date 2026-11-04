"use client";
import Link from "next/link";
import { useState } from "react";
import type { AnalyzedArticle, Bar, GeoRisk, Outlook, Quote } from "@/lib/types";
import { useJson } from "@/lib/client/hooks";
import { displaySymbol, fmtMoney, fmtPct, fmtPrice, timeAgo } from "@/lib/client/format";
import { placeOrder, toggleWatch, usePortfolio } from "@/lib/client/portfolio";
import { Card, Change, DataBadge, DivergingBar, ErrorNote, Skeleton, StanceChip, TrendChip } from "./ui";
import PriceChart from "./PriceChart";
import ResearchPanel from "./ResearchPanel";
import { ArticleRow } from "./NewsBits";

interface Report {
  quote: Quote;
  bars: Bar[];
  outlooks: Outlook[];
  news: { score: number; contributions: { title: string; source: string; url: string | null; score: number; why: string; published: number }[] };
  digest: { geoRisk: GeoRisk; sample: boolean };
  related: AnalyzedArticle[];
}

const HORIZON_LABEL = ["1 week", "1 month", "1 quarter"];

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div title={hint}>
      <div className="text-xs muted">{label}</div>
      <div className="num font-semibold">{value}</div>
    </div>
  );
}

function OutlookPanel({ outlooks }: { outlooks: Outlook[] }) {
  const [h, setH] = useState(1);
  const o = outlooks[h];
  const maxMove = Math.max(...o.scenarios.map((s) => Math.abs(s.move)), 0.01);
  return (
    <Card
      title="Speculative outlook"
      right={
        <div className="seg" role="group" aria-label="Outlook horizon">
          {HORIZON_LABEL.map((l, i) => (
            <button key={l} aria-pressed={h === i} onClick={() => setH(i)}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <StanceChip stance={o.stance} score={o.score} />
        <span className="text-sm">
          <span className="num font-bold">{Math.round(o.probUp * 100)}%</span> <span className="soft">chance higher</span>
        </span>
        <span className="text-sm">
          <span className="num font-bold">±{(o.expectedMove * 100).toFixed(1)}%</span> <span className="soft">typical move</span>
        </span>
        <span className="text-sm">
          <span className="num font-bold">{Math.round(o.confidence * 100)}%</span> <span className="soft">confidence</span>
        </span>
      </div>
      <p className="mb-4 text-sm leading-relaxed soft">{o.summary}</p>
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {o.scenarios.map((s) => (
          <div key={s.name} className="rounded-xl p-3" style={{ background: s.name === "Bull" ? "var(--up-soft)" : s.name === "Bear" ? "var(--down-soft)" : "var(--surface-2)" }}>
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{s.name} case</span>
              <span className="num text-sm font-semibold">{Math.round(s.probability * 100)}%</span>
            </div>
            <div className="num mt-1 text-lg font-bold">{fmtPrice(s.target)}</div>
            <div className={`num text-sm ${s.move >= 0 ? "up" : "down"}`}>
              {s.move >= 0 ? "▲" : "▼"} {fmtPct(s.move, 1)}
            </div>
            <div className="mt-1 h-1.5 rounded-full" style={{ background: "var(--neutral-mid)" }} aria-hidden>
              <div className="h-1.5 rounded-full" style={{ width: `${(Math.abs(s.move) / maxMove) * 100}%`, background: s.move >= 0 ? "var(--up-fill)" : "var(--down-fill)" }} />
            </div>
            <p className="mt-2 text-xs leading-snug soft">{s.narrative}</p>
          </div>
        ))}
      </div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold muted">
        <span>What drives the score</span>
        <span>
          technical {o.technicalScore > 0 ? "+" : ""}
          {o.technicalScore} · news {o.newsScore > 0 ? "+" : ""}
          {o.newsScore}
        </span>
      </div>
      <ul className="space-y-2">
        {o.drivers.map((d) => (
          <li key={d.label} className="text-xs">
            <div className="mb-0.5 flex justify-between gap-3">
              <span className="truncate">
                <span className="chip mr-1.5 py-0 text-[10px]">{d.kind}</span>
                {d.label}
              </span>
              <span className={`num ${d.impact >= 0 ? "up" : "down"}`}>{d.impact > 0 ? "+" : ""}{d.impact}</span>
            </div>
            <DivergingBar value={d.impact} max={40} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TradeTicket({ quote }: { quote: Quote }) {
  const pf = usePortfolio();
  const [qty, setQty] = useState("10");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sym = quote.instrument.symbol;
  const price = quote.technicals.last;
  const pos = pf.positions[sym];
  const isIndex = quote.instrument.cls === "index";
  const n = Number(qty);

  function submit(side: "buy" | "sell") {
    const err = placeOrder({ symbol: sym, name: quote.instrument.name, side, qty: n, price });
    setMsg(err ? { ok: false, text: err } : { ok: true, text: `${side === "buy" ? "Bought" : "Sold"} ${n} ${displaySymbol(sym)} at ${fmtPrice(price)} (paper).` });
  }

  return (
    <Card title="Paper trade" right={<Link href="/portfolio" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>Portfolio →</Link>}>
      {isIndex ? (
        <p className="text-sm soft">
          Indexes can&apos;t be traded directly. Trade a tracking ETF instead, such as{" "}
          <Link className="underline" href="/symbol/SPY">SPY</Link>, <Link className="underline" href="/symbol/QQQ">QQQ</Link>,{" "}
          <Link className="underline" href="/symbol/DIA">DIA</Link> or <Link className="underline" href="/symbol/IWM">IWM</Link>.
        </p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Cash available" value={fmtMoney(pf.cash)} />
            <Stat label="You hold" value={pos ? `${pos.qty} @ ${fmtPrice(pos.avgCost)}` : "—"} />
          </div>
          <label className="lbl" htmlFor="qty">Quantity (shares)</label>
          <input id="qty" className="input num mb-1" type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          <p className="mb-3 text-xs soft">
            Estimated value <span className="num font-semibold">{fmtMoney((n || 0) * price)}</span> at {fmtPrice(price)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-up" onClick={() => submit("buy")}>Buy</button>
            <button className="btn btn-down" onClick={() => submit("sell")} disabled={!pos}>Sell</button>
          </div>
          {msg && <p className={`mt-2 text-sm ${msg.ok ? "up" : "down"}`}>{msg.ok ? "✓" : "⚠"} {msg.text}</p>}
        </>
      )}
      <p className="mt-3 text-xs muted">Virtual money only. Fills at the last price shown.</p>
    </Card>
  );
}

export default function SymbolView({ symbol }: { symbol: string }) {
  const { data, error, reload } = useJson<Report>(`/api/symbol/${encodeURIComponent(symbol)}`, 5 * 60 * 1000);
  const pf = usePortfolio();

  if (error) return <ErrorNote text={`Couldn't load ${symbol}: ${error}`} onRetry={reload} />;
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton h={40} w={320} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton h={380} className="lg:col-span-2" />
          <Skeleton h={380} />
        </div>
      </div>
    );

  const { quote, bars, outlooks, news, related } = data;
  const t = quote.technicals;
  const i = quote.instrument;
  const watched = pf.watchlist.includes(i.symbol);
  const debateHref = `/debate?symbol=${encodeURIComponent(i.symbol)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm soft">
            <span className="chip">{i.cls === "etf" ? "ETF" : i.cls === "index" ? "Index" : "Stock"}</span>
            <span>{i.sector}</span>
            <span>·</span>
            <span>{i.region}</span>
            <DataBadge mode={quote.source} />
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {i.name} <span className="soft font-medium">{displaySymbol(i.symbol)}</span>
          </h1>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="num text-3xl font-bold">{fmtPrice(t.last)}</span>
            <Change value={t.change1d} className="text-lg font-semibold" />
            <span className="text-sm soft">today</span>
            <TrendChip trend={t.trend} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => toggleWatch(i.symbol)} aria-pressed={watched}>
            {watched ? "★ Watching" : "☆ Watch"}
          </button>
          <Link className="btn btn-primary" href={debateHref}>
            ⚖ Debate a trade on {displaySymbol(i.symbol)}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <PriceChart bars={bars} levels={{ support: t.support, resistance: t.resistance }} />
        </Card>
        <Card title="Technicals">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="1 week" value={<Change value={t.change5d} />} />
            <Stat label="1 month" value={<Change value={t.change1m} />} />
            <Stat label="3 months" value={<Change value={t.change3m} />} />
            <Stat label="YTD" value={<Change value={t.changeYtd} />} />
            <Stat label="1 year" value={<Change value={t.change1y} />} />
            <Stat label="Volatility" value={`${(t.volAnnual * 100).toFixed(0)}%`} hint="Annualised, last 60 days" />
            <Stat label="20-day avg" value={fmtPrice(t.sma20)} />
            <Stat label="50-day avg" value={fmtPrice(t.sma50)} />
            <Stat label="200-day avg" value={fmtPrice(t.sma200)} />
            <Stat label="RSI (14)" value={t.rsi14?.toFixed(1) ?? "—"} hint="Above 70 overbought, below 30 oversold" />
            <Stat label="MACD hist" value={t.macd ? t.macd.hist.toFixed(2) : "—"} />
            <Stat label="ATR (14)" value={fmtPrice(t.atr14)} hint="Average daily range" />
            <Stat label="52w low" value={fmtPrice(t.low52)} />
            <Stat label="52w high" value={fmtPrice(t.high52)} />
            <Stat label="From high" value={<Change value={t.last / t.high52 - 1} />} />
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs muted">
              <span>Trend score</span>
              <span className="num">{t.trendScore}</span>
            </div>
            <DivergingBar value={t.trendScore} />
          </div>
          {t.signals.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {t.signals.map((s) => (
                <li key={s} className="flex gap-2">
                  <span aria-hidden style={{ color: "var(--accent)" }}>◆</span>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OutlookPanel outlooks={outlooks} />
        </div>
        <TradeTicket quote={quote} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="How the news is hitting it" right={<span className={`chip num ${news.score > 8 ? "chip-up" : news.score < -8 ? "chip-down" : ""}`}>net {news.score > 0 ? "+" : ""}{news.score}</span>}>
          {news.contributions.length === 0 ? (
            <p className="text-sm soft">No current headlines map strongly onto {displaySymbol(i.symbol)}.</p>
          ) : (
            <ul className="space-y-3">
              {news.contributions.map((c) => (
                <li key={c.title} className="text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs muted">
                        {c.source} · {timeAgo(c.published)}
                      </div>
                      {c.url ? (
                        <a className="font-medium hover:underline" href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a>
                      ) : (
                        <span className="font-medium">{c.title}</span>
                      )}
                      <div className="text-xs soft">{c.why}</div>
                    </div>
                    <span className={`chip num shrink-0 ${c.score > 0 ? "chip-up" : "chip-down"}`}>{c.score > 0 ? "▲" : "▼"} {Math.abs(c.score).toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <ResearchPanel symbol={i.symbol} title={`Deep research · ${displaySymbol(i.symbol)}`} />
      </div>

      {related.length > 0 && (
        <Card title="Related headlines">
          <ul>
            {related.map((a) => (
              <ArticleRow key={a.id} a={a} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
