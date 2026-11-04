import type { Bar, DataSource } from "../types";

export interface ProviderResult {
  bars: Bar[];
  source: DataSource;
  currency: string;
  name?: string;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

async function fetchWithTimeout(url: string, ms = 8000, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": UA, Accept: "*/*", ...(init.headers ?? {}) }, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

// ---- Yahoo Finance (chart API, no key) ----

interface YahooChart {
  chart?: {
    result?: {
      meta?: { currency?: string; longName?: string; shortName?: string; regularMarketPrice?: number; regularMarketTime?: number };
      timestamp?: number[];
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

export function parseYahooChart(json: YahooChart): ProviderResult | null {
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp;
  const q = r?.indicators?.quote?.[0];
  if (!r || !ts || !q) return null;
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (c == null || !Number.isFinite(c)) continue;
    const o = q.open?.[i] ?? c;
    bars.push({ t: ts[i] * 1000, o, h: q.high?.[i] ?? Math.max(o, c), l: q.low?.[i] ?? Math.min(o, c), c, v: q.volume?.[i] ?? 0 });
  }
  // Yahoo's last bar can lag the live price intraday; patch the close with the live quote.
  const live = r.meta?.regularMarketPrice;
  const liveT = r.meta?.regularMarketTime;
  if (live && liveT && bars.length) {
    const lastBar = bars[bars.length - 1];
    const sameDay = new Date(lastBar.t).toISOString().slice(0, 10) === new Date(liveT * 1000).toISOString().slice(0, 10);
    if (sameDay) lastBar.c = live;
  }
  if (bars.length < 30) return null;
  return { bars, source: "yahoo", currency: r.meta?.currency ?? "USD", name: r.meta?.longName ?? r.meta?.shortName };
}

export async function fetchYahoo(symbol: string, range = "2y"): Promise<ProviderResult | null> {
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false&events=div%2Csplits`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const parsed = parseYahooChart((await res.json()) as YahooChart);
      if (parsed) return parsed;
    } catch {
      // try the next host
    }
  }
  return null;
}

// ---- Stooq (CSV, no key) ----

const STOOQ_INDEX: Record<string, string> = {
  "^GSPC": "^spx",
  "^IXIC": "^ndq",
  "^DJI": "^dji",
  "^RUT": "^rut",
  "^VIX": "^vix",
  "^FTSE": "^ftm",
  "^GDAXI": "^dax",
  "^N225": "^nkx",
  "^HSI": "^hsi",
};

export function stooqSymbol(symbol: string): string {
  return STOOQ_INDEX[symbol] ?? `${symbol.toLowerCase()}.us`;
}

export function parseStooqCsv(csv: string): Bar[] {
  const lines = csv.trim().split(/\r?\n/);
  if (!lines[0]?.toLowerCase().startsWith("date")) return [];
  const bars: Bar[] = [];
  for (const line of lines.slice(1)) {
    const [d, o, h, l, c, v] = line.split(",");
    const close = Number(c);
    if (!d || !Number.isFinite(close)) continue;
    bars.push({ t: Date.parse(`${d}T21:00:00Z`), o: Number(o), h: Number(h), l: Number(l), c: close, v: Number(v) || 0 });
  }
  return bars;
}

export async function fetchStooq(symbol: string): Promise<ProviderResult | null> {
  try {
    const res = await fetchWithTimeout(`https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol(symbol))}&i=d`);
    if (!res.ok) return null;
    const bars = parseStooqCsv(await res.text()).slice(-520);
    if (bars.length < 30) return null;
    return { bars, source: "stooq", currency: "USD" };
  } catch {
    return null;
  }
}
