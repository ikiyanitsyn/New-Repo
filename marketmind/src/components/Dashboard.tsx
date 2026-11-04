"use client";
import Link from "next/link";
import { useState } from "react";
import type { AnalyzedArticle, GeoRisk, Outlook, Quote, ThemeSummary } from "@/lib/types";
import { useJson } from "@/lib/client/hooks";
import { displaySymbol, fmtPct, fmtPrice, symbolHref } from "@/lib/client/format";
import { Card, Change, DataBadge, DivergingBar, ErrorNote, ScoreChip, Skeleton, StanceChip, SymbolLink } from "./ui";
import Sparkline from "./Sparkline";
import { ArticleRow, GeoRiskGauge, SourceStatus, ImpactChips } from "./NewsBits";
import ResearchPanel from "./ResearchPanel";

interface Overview {
  mode: "live" | "mixed" | "sample";
  indices: Quote[];
  sectors: Quote[];
  macro: Quote[];
  gainers: Quote[];
  losers: Quote[];
  trendLeaders: Quote[];
  marketOutlook: Outlook;
  newsWatch: { symbol: string; name: string; score: number }[];
  news: {
    geoRisk: GeoRisk;
    sentiment: number;
    themes: ThemeSummary[];
    top: AnalyzedArticle[];
    sources: { id: string; name: string; status: "live" | "unavailable"; count: number }[];
    sample: boolean;
  };
}

function heatColor(x: number, scale: number) {
  const k = Math.max(-1, Math.min(1, x / scale));
  const a = 0.12 + Math.abs(k) * 0.6;
  return k >= 0 ? `rgba(12,163,12,${a})` : `rgba(208,59,59,${a})`;
}

function SectorHeatmap({ sectors }: { sectors: Quote[] }) {
  const [period, setPeriod] = useState<"1d" | "1m" | "ytd">("1d");
  const pick = (q: Quote) => (period === "1d" ? q.technicals.change1d : period === "1m" ? q.technicals.change1m : q.technicals.changeYtd);
  const scale = period === "1d" ? 0.025 : period === "1m" ? 0.08 : 0.25;
  const sorted = [...sectors].sort((a, b) => pick(b) - pick(a));
  return (
    <Card
      title="Sector heatmap"
      right={
        <div className="seg" role="group" aria-label="Heatmap period">
          {(["1d", "1m", "ytd"] as const).map((p) => (
            <button key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-[2px] overflow-hidden rounded-lg sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((q) => {
          const v = pick(q);
          return (
            <Link
              key={q.instrument.symbol}
              href={symbolHref(q.instrument.symbol)}
              className="flex min-h-[74px] flex-col justify-between p-2.5 hover:brightness-110"
              style={{ background: heatColor(v, scale) }}
              title={`${q.instrument.name}: ${fmtPct(v)} (${period})`}
            >
              <div className="text-xs font-semibold">{q.instrument.sector}</div>
              <div className="flex items-end justify-between">
                <span className="text-xs soft">{q.instrument.symbol}</span>
                <span className="num text-sm font-bold">
                  {v >= 0 ? "▲" : "▼"} {fmtPct(v, 1)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function QuoteList({ quotes, metric = "d1" }: { quotes: Quote[]; metric?: "d1" | "trend" }) {
  return (
    <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
      {quotes.map((q) => (
        <li key={q.instrument.symbol} className="flex items-center justify-between gap-2 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
          <SymbolLink symbol={q.instrument.symbol} name={q.instrument.name} className="min-w-0 truncate" />
          <div className="flex shrink-0 items-center gap-3">
            <Sparkline data={q.spark.slice(-30)} width={60} height={20} />
            <span className="num w-20 text-right">{fmtPrice(q.technicals.last)}</span>
            {metric === "d1" ? <Change value={q.technicals.change1d} className="w-16 text-right" /> : <span className="num w-16 text-right">{q.technicals.trendScore}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { data, error, reload } = useJson<Overview>("/api/overview", 5 * 60 * 1000);
  const [moverTab, setMoverTab] = useState<"gainers" | "losers" | "trend">("gainers");

  if (error) return <ErrorNote text={`Couldn't load the market overview: ${error}`} onRetry={reload} />;
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton h={28} w={260} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h={110} />)}</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} h={260} />)}</div>
      </div>
    );

  const o = data.marketOutlook;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market pulse</h1>
          <p className="text-sm soft">Trends across indexes, sectors and macro assets, read against the day&apos;s geopolitical and economic news.</p>
        </div>
        <div className="flex items-center gap-2">
          <DataBadge mode={data.mode} />
          <button className="btn py-1 text-xs" onClick={reload}>↻ Refresh</button>
        </div>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5 xl:grid-cols-9">
        {data.indices.map((q) => (
          <Link key={q.instrument.symbol} href={symbolHref(q.instrument.symbol)} className="card min-w-[150px] p-3 hover:brightness-[1.03]">
            <div className="truncate text-xs font-semibold soft">{q.instrument.name}</div>
            <div className="num mt-0.5 text-lg font-bold">{fmtPrice(q.technicals.last)}</div>
            <Change value={q.technicals.change1d} className="text-sm" />
            <Sparkline data={q.spark} width={130} height={30} className="mt-1 w-full" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="S&P 500 · one-month outlook" right={<StanceChip stance={o.stance} score={o.score} />}>
          <div className="mb-3 flex items-end gap-4">
            <div>
              <div className="num text-3xl font-bold">{Math.round(o.probUp * 100)}%</div>
              <div className="text-xs soft">chance of finishing higher</div>
            </div>
            <div>
              <div className="num text-xl font-semibold">±{(o.expectedMove * 100).toFixed(1)}%</div>
              <div className="text-xs soft">typical 1-month move</div>
            </div>
            <div>
              <div className="num text-xl font-semibold">{Math.round(o.confidence * 100)}%</div>
              <div className="text-xs soft">model confidence</div>
            </div>
          </div>
          <p className="mb-3 text-sm leading-relaxed soft">{o.summary}</p>
          <div className="space-y-2">
            {o.drivers.slice(0, 5).map((d) => (
              <div key={d.label} className="text-xs">
                <div className="mb-0.5 flex justify-between gap-2">
                  <span className="truncate">{d.label}</span>
                  <span className={`num ${d.impact >= 0 ? "up" : "down"}`}>{d.impact > 0 ? "+" : ""}{d.impact}</span>
                </div>
                <DivergingBar value={d.impact} max={40} />
              </div>
            ))}
          </div>
          <Link href={symbolHref("^GSPC")} className="mt-3 inline-block text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Full S&P 500 analysis →
          </Link>
        </Card>

        <Card title="Geopolitical risk" right={<Link href="/news" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>All themes →</Link>}>
          <GeoRiskGauge geo={data.news.geoRisk} />
          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold muted">Hottest regions</div>
            <div className="flex flex-wrap gap-1.5">
              {data.news.geoRisk.regions.slice(0, 6).map((r) => (
                <span key={r.region} className="chip num">{r.region} {r.heat}</span>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold muted">Top market themes right now</div>
            <ul className="space-y-1.5">
              {data.news.themes.slice(0, 4).map((t) => (
                <li key={t.themeId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{t.label}</span>
                  <ImpactChips impacts={t.topImpacts} max={3} />
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="News is leaning on" right={<span className="text-xs muted">score −100…+100</span>}>
          <p className="mb-2 text-xs soft">Instruments where the current headlines point hardest one way, after mapping every story through its theme.</p>
          <ul className="space-y-2">
            {data.newsWatch.map((w) => (
              <li key={w.symbol} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 text-sm">
                <SymbolLink symbol={w.symbol} name={w.name} className="truncate" />
                <ScoreChip score={w.score} />
                <div className="col-span-2">
                  <DivergingBar value={w.score} />
                </div>
              </li>
            ))}
            {data.newsWatch.length === 0 && <li className="text-sm soft">The news flow isn&apos;t leaning strongly on anything right now.</li>}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectorHeatmap sectors={data.sectors} />
        </div>
        <Card title="Macro & cross-asset">
          <QuoteList quotes={data.macro} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Market-moving headlines"
          right={<Link href="/news" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>News & geopolitics →</Link>}
        >
          <SourceStatus sources={data.news.sources} sample={data.news.sample} />
          <ul className="mt-1">
            {data.news.top.map((a) => (
              <ArticleRow key={a.id} a={a} compact />
            ))}
          </ul>
        </Card>
        <Card
          title="Movers"
          right={
            <div className="seg" role="group" aria-label="Movers list">
              {(
                [
                  ["gainers", "Gainers"],
                  ["losers", "Losers"],
                  ["trend", "Trend"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} aria-pressed={moverTab === k} onClick={() => setMoverTab(k)}>
                  {l}
                </button>
              ))}
            </div>
          }
        >
          {moverTab === "trend" ? (
            <>
              <p className="mb-1 text-xs soft">Strongest trend scores among followed stocks.</p>
              <QuoteList quotes={data.trendLeaders} metric="trend" />
            </>
          ) : (
            <QuoteList quotes={moverTab === "gainers" ? data.gainers : data.losers} />
          )}
          <Link href="/markets" className="mt-3 inline-block text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Open the full screener →
          </Link>
        </Card>
      </div>

      <ResearchPanel title="AI market brief" />
      <p className="text-xs muted">
        Tip: open any ticker (for example {["NVDA", "XLE", "GLD", "^VIX"].map((s, i) => (
          <span key={s}>
            {i > 0 && ", "}
            <Link className="underline" href={symbolHref(s)}>{displaySymbol(s)}</Link>
          </span>
        ))}) for its chart, outlook scenarios and news impact, then send the trade idea to the Advisor Roundtable.
      </p>
    </div>
  );
}
