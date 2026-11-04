import "server-only";
import type { Instrument, Quote, Series } from "../types";
import { cached } from "../cache";
import { instrumentFor, normalizeSymbol } from "../universe";
import { computeTechnicals } from "./indicators";
import { fetchStooq, fetchYahoo } from "./providers";
import { sampleBars } from "./sample";

const PRICE_TTL = 5 * 60 * 1000;

/**
 * Circuit breaker: if live sources keep failing (offline laptop, blocked network), stop waiting
 * on timeouts for a while and serve sample data straight away.
 */
let liveFailures = 0;
let liveBlockedUntil = 0;

function offlineForced() {
  return process.env.MARKETMIND_OFFLINE === "1" || process.env.MARKETMIND_OFFLINE === "true";
}

function liveAllowed() {
  return !offlineForced() && Date.now() > liveBlockedUntil;
}

function noteLive(ok: boolean) {
  if (ok) {
    liveFailures = 0;
    return;
  }
  liveFailures++;
  if (liveFailures >= 4) {
    liveBlockedUntil = Date.now() + 3 * 60 * 1000;
    liveFailures = 0;
  }
}

const discoveredNames = new Map<string, string>();

export async function getSeries(rawSymbol: string): Promise<Series> {
  const symbol = normalizeSymbol(rawSymbol);
  return cached(`series:${symbol}`, PRICE_TTL, async () => {
    if (liveAllowed()) {
      const live = (await fetchYahoo(symbol)) ?? (await fetchStooq(symbol));
      noteLive(!!live);
      if (live) {
        if (live.name) discoveredNames.set(symbol, live.name);
        return { symbol, bars: live.bars, source: live.source, currency: live.currency, fetchedAt: Date.now() };
      }
    }
    return { symbol, bars: sampleBars(symbol), source: "sample", currency: "USD", fetchedAt: Date.now() };
  });
}

export function describe(symbol: string): Instrument {
  const inst = instrumentFor(symbol);
  const found = discoveredNames.get(inst.symbol);
  return found && inst.name === inst.symbol ? { ...inst, name: found } : inst;
}

export async function getQuote(symbol: string): Promise<Quote> {
  const series = await getSeries(symbol);
  const technicals = computeTechnicals(series.bars);
  return {
    instrument: describe(series.symbol),
    technicals,
    spark: series.bars.slice(-60).map((b) => b.c),
    source: series.source,
  };
}

/** Fetch many quotes with a small concurrency limit so we stay polite to free data sources. */
export async function getQuotes(symbols: string[], concurrency = 6): Promise<Quote[]> {
  const out: Quote[] = new Array(symbols.length);
  let next = 0;
  async function worker() {
    while (next < symbols.length) {
      const i = next++;
      out[i] = await getQuote(symbols[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));
  return out;
}

export function dataMode(quotes: { source: string }[]): "live" | "mixed" | "sample" {
  const live = quotes.filter((q) => q.source !== "sample").length;
  if (live === quotes.length) return "live";
  if (live === 0) return "sample";
  return "mixed";
}
