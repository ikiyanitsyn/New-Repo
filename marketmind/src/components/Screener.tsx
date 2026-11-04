"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Outlook, TrendState } from "@/lib/types";
import { useJson } from "@/lib/client/hooks";
import { displaySymbol, fmtPrice, symbolHref } from "@/lib/client/format";
import { Change, DataBadge, ErrorNote, ScoreChip, Skeleton, StanceChip, TrendChip } from "./ui";
import Sparkline from "./Sparkline";

interface Row {
  symbol: string;
  name: string;
  cls: "index" | "etf" | "stock";
  sector: string;
  last: number;
  d1: number;
  w1: number;
  m1: number;
  m3: number;
  ytd: number;
  y1: number;
  rsi: number | null;
  vol: number;
  trend: TrendState;
  trendScore: number;
  news: number;
  outlook: number;
  stance: Outlook["stance"];
  probUp: number;
  spark: number[];
  source: string;
}

type Key = keyof Pick<Row, "symbol" | "last" | "d1" | "w1" | "m1" | "m3" | "ytd" | "y1" | "rsi" | "vol" | "trendScore" | "news" | "outlook">;

const COLS: [Key, string, string][] = [
  ["last", "Last", ""],
  ["d1", "1D", "Change today"],
  ["w1", "1W", "Change over 5 trading days"],
  ["m1", "1M", "Change over 21 trading days"],
  ["m3", "3M", "Change over 63 trading days"],
  ["ytd", "YTD", "Change since the start of the year"],
  ["rsi", "RSI", "14-day Relative Strength Index: above 70 overbought, below 30 oversold"],
  ["vol", "Vol", "Annualised volatility (60 days)"],
  ["trendScore", "Trend", "Trend score −100…+100 from moving averages, slope and momentum"],
  ["news", "News", "How the current headlines lean on this instrument, −100…+100"],
  ["outlook", "Outlook", "MarketMind's one-month speculative outlook score"],
];

export default function Screener() {
  const router = useRouter();
  const { data, error, reload } = useJson<{ mode: string; rows: Row[] }>("/api/screener", 5 * 60 * 1000);
  const [cls, setCls] = useState<"all" | "index" | "etf" | "stock">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "outlook", dir: -1 });
  const [trendFilter, setTrendFilter] = useState<"any" | "up" | "down">("any");

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.rows
      .filter((r) => cls === "all" || r.cls === cls)
      .filter((r) => !needle || r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle) || r.sector.toLowerCase().includes(needle))
      .filter((r) => trendFilter === "any" || (trendFilter === "up" ? r.trend.includes("up") : r.trend.includes("down")))
      .sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sort.dir;
        return (((av as number) ?? -Infinity) - ((bv as number) ?? -Infinity)) * sort.dir;
      });
  }, [data, cls, q, sort, trendFilter]);

  if (error) return <ErrorNote text={`Couldn't load the screener: ${error}`} onRetry={reload} />;

  const head = (key: Key, label: string, title: string) => (
    <th key={key} title={title} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="uppercase" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : -1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
          <p className="text-sm soft">Every index, ETF and stock MarketMind follows, with trend, momentum, news pressure and the model&apos;s one-month outlook. Click a row for the full analysis.</p>
        </div>
        {data && <DataBadge mode={data.mode} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg" role="group" aria-label="Asset class">
          {(
            [
              ["all", "All"],
              ["index", "Indexes"],
              ["etf", "ETFs"],
              ["stock", "Stocks"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={cls === k} onClick={() => setCls(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Trend filter">
          {(
            [
              ["any", "Any trend"],
              ["up", "Uptrends"],
              ["down", "Downtrends"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={trendFilter === k} onClick={() => setTrendFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <input className="input max-w-xs py-1.5" placeholder="Filter by name, ticker or sector…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter" />
        {data && <span className="text-xs muted">{rows.length} shown</span>}
      </div>
      <div className="card overflow-x-auto">
        {!data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} h={28} />)}</div>
        ) : (
          <table className="tbl num w-full text-sm">
            <thead>
              <tr>
                {head("symbol", "Instrument", "Sort by ticker")}
                <th>30D</th>
                {COLS.map(([k, l, t]) => head(k, l, t))}
                <th>Stance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol} className="cursor-pointer" onClick={() => router.push(symbolHref(r.symbol))}>
                  <td className="max-w-[240px]">
                    <a href={symbolHref(r.symbol)} onClick={(e) => e.preventDefault()} className="block truncate">
                      <span className="font-semibold">{displaySymbol(r.symbol)}</span> <span className="soft">{r.name}</span>
                    </a>
                    <div className="text-xs muted">{r.cls === "etf" ? "ETF" : r.cls === "index" ? "Index" : "Stock"} · {r.sector}</div>
                  </td>
                  <td>
                    <Sparkline data={r.spark} width={70} height={22} />
                  </td>
                  <td>{fmtPrice(r.last)}</td>
                  <td><Change value={r.d1} /></td>
                  <td><Change value={r.w1} /></td>
                  <td><Change value={r.m1} /></td>
                  <td><Change value={r.m3} /></td>
                  <td><Change value={r.ytd} /></td>
                  <td className={r.rsi != null && (r.rsi > 70 || r.rsi < 30) ? "font-semibold" : ""}>
                    {r.rsi?.toFixed(0) ?? "—"}
                    {r.rsi != null && r.rsi > 70 && <span className="ml-1 text-xs down" title="Overbought">OB</span>}
                    {r.rsi != null && r.rsi < 30 && <span className="ml-1 text-xs up" title="Oversold">OS</span>}
                  </td>
                  <td>{(r.vol * 100).toFixed(0)}%</td>
                  <td><TrendChip trend={r.trend} /></td>
                  <td><ScoreChip score={r.news} /></td>
                  <td><ScoreChip score={r.outlook} /></td>
                  <td><StanceChip stance={r.stance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
