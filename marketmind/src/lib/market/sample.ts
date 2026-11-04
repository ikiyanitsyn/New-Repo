import type { Bar } from "../types";
import { SAMPLE_ANCHORS } from "../universe";

/** Deterministic PRNG so the same ticker always draws the same sample history. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gauss(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Trading days (Mon-Fri) ending at the most recent weekday close. */
function tradingDays(count: number, end = new Date()): number[] {
  const days: number[] = [];
  const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 21));
  while (days.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(d.getTime());
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days.reverse();
}

/**
 * Illustrative price history (geometric Brownian motion with regime shifts) that ends at a
 * plausible level for the instrument. Used only when no live source can be reached, and always
 * labelled as sample data in the UI.
 */
export function sampleBars(symbol: string, days = 520): Bar[] {
  const anchor = SAMPLE_ANCHORS[symbol] ?? {
    price: 20 + (hashString(symbol) % 380),
    vol: 0.3,
    drift: 0.08,
  };
  const rand = mulberry32(hashString(symbol + ":v1"));
  const times = tradingDays(days);
  const dt = 1 / 252;
  const isVix = symbol === "^VIX";

  // Walk backwards from the anchor price so the series ends where the anchor says.
  const rets: number[] = [];
  let regimeDrift = anchor.drift;
  for (let i = 0; i < days; i++) {
    if (rand() < 0.012) regimeDrift = anchor.drift + (rand() - 0.5) * anchor.vol * 1.6;
    const shock = gauss(rand) * anchor.vol * Math.sqrt(dt);
    rets.push((regimeDrift - 0.5 * anchor.vol ** 2) * dt + shock);
  }
  const closes = new Array(days).fill(0);
  closes[days - 1] = anchor.price;
  for (let i = days - 2; i >= 0; i--) closes[i] = closes[i + 1] / Math.exp(rets[i + 1]);
  if (isVix) {
    // VIX mean-reverts; squash the random walk around its anchor.
    for (let i = 0; i < days; i++) closes[i] = Math.max(10, anchor.price * (1 + 0.45 * Math.tanh(Math.log(closes[i] / anchor.price))));
    closes[days - 1] = anchor.price;
  }

  return times.map((t, i) => {
    const c = closes[i];
    const o = i === 0 ? c : closes[i - 1] * (1 + gauss(rand) * anchor.vol * 0.15 * Math.sqrt(dt));
    const range = Math.abs(gauss(rand)) * anchor.vol * Math.sqrt(dt) * c * 0.8;
    const h = Math.max(o, c) + range * rand();
    const l = Math.min(o, c) - range * rand();
    const v = Math.round((1e6 + (hashString(symbol) % 5e7)) * (0.6 + rand() * 0.9));
    return { t, o: round(o), h: round(h), l: round(Math.max(l, 0.01)), c: round(c), v };
  });
}

function round(x: number) {
  return x >= 100 ? Math.round(x * 100) / 100 : Math.round(x * 10000) / 10000;
}
