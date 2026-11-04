import type { Bar, Technicals, TrendState } from "../types";

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const line: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (ef[i] != null && es[i] != null) {
      line.push((ef[i] as number) - (es[i] as number));
      idx.push(i);
    }
  }
  const sig = ema(line, signal);
  const out: ({ macd: number; signal: number; hist: number } | null)[] = new Array(values.length).fill(null);
  for (let j = 0; j < line.length; j++) {
    if (sig[j] != null) out[idx[j]] = { macd: line[j], signal: sig[j] as number, hist: line[j] - (sig[j] as number) };
  }
  return out;
}

export function bollinger(values: number[], period = 20, k = 2) {
  const mid = sma(values, period);
  return values.map((v, i) => {
    const m = mid[i];
    if (m == null) return null;
    const slice = values.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(slice.reduce((a, x) => a + (x - m) ** 2, 0) / period);
    const upper = m + k * sd;
    const lower = m - k * sd;
    return { upper, middle: m, lower, pctB: upper === lower ? 0.5 : (v - lower) / (upper - lower) };
  });
}

export function atr(bars: Bar[], period = 14): number | null {
  if (bars.length <= period) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const pc = bars[i - 1].c;
    trs.push(Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)));
  }
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
  return a;
}

export function logReturns(values: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < values.length; i++) if (values[i - 1] > 0 && values[i] > 0) r.push(Math.log(values[i] / values[i - 1]));
  return r;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Linear-regression slope of the last n values, as a fraction of the mean per bar. */
export function slope(values: number[], n: number): number {
  const ys = values.slice(-n);
  if (ys.length < 3) return 0;
  const xm = (ys.length - 1) / 2;
  const ym = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  ys.forEach((y, i) => {
    num += (i - xm) * (y - ym);
    den += (i - xm) ** 2;
  });
  return den === 0 || ym === 0 ? 0 : num / den / ym;
}

function pctChange(closes: number[], back: number): number {
  if (closes.length <= back) return closes.length > 1 ? closes[closes.length - 1] / closes[0] - 1 : 0;
  const prev = closes[closes.length - 1 - back];
  return prev ? closes[closes.length - 1] / prev - 1 : 0;
}

/** Pivot-based support/resistance: nearest swing low below and swing high above the last price. */
export function supportResistance(bars: Bar[], lookback = 120): { support: number | null; resistance: number | null } {
  const b = bars.slice(-lookback);
  const last = b[b.length - 1]?.c;
  if (!last) return { support: null, resistance: null };
  const lows: number[] = [];
  const highs: number[] = [];
  for (let i = 3; i < b.length - 3; i++) {
    const win = b.slice(i - 3, i + 4);
    if (win.every((x) => x.l >= b[i].l)) lows.push(b[i].l);
    if (win.every((x) => x.h <= b[i].h)) highs.push(b[i].h);
  }
  const below = lows.filter((x) => x < last).sort((x, y) => y - x);
  const above = highs.filter((x) => x > last).sort((x, y) => x - y);
  return { support: below[0] ?? null, resistance: above[0] ?? null };
}

export function classifyTrend(score: number): TrendState {
  if (score >= 55) return "strong-up";
  if (score >= 18) return "up";
  if (score <= -55) return "strong-down";
  if (score <= -18) return "down";
  return "sideways";
}

export const TREND_LABEL: Record<TrendState, string> = {
  "strong-up": "Strong uptrend",
  up: "Uptrend",
  sideways: "Range-bound",
  down: "Downtrend",
  "strong-down": "Strong downtrend",
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Every technical the app shows for an instrument, computed from daily bars. */
export function computeTechnicals(bars: Bar[]): Technicals {
  const closes = bars.map((b) => b.c);
  const n = closes.length;
  const last = closes[n - 1] ?? 0;
  const s20 = sma(closes, 20)[n - 1] ?? null;
  const s50 = sma(closes, 50)[n - 1] ?? null;
  const s200 = sma(closes, 200)[n - 1] ?? null;
  const r = rsi(closes, 14)[n - 1] ?? null;
  const m = macd(closes)[n - 1] ?? null;
  const bb = bollinger(closes)[n - 1] ?? null;
  const a = atr(bars);
  const rets = logReturns(closes.slice(-61));
  const volAnnual = stdev(rets) * Math.sqrt(252);
  const yr = bars.slice(-252);
  const high52 = Math.max(...yr.map((b) => b.h));
  const low52 = Math.min(...yr.map((b) => b.l));

  const lastDate = new Date(bars[n - 1]?.t ?? Date.now());
  const yStart = Date.UTC(lastDate.getUTCFullYear(), 0, 1);
  const firstOfYear = bars.find((b) => b.t >= yStart);
  const prevYearClose = bars.filter((b) => b.t < yStart).pop()?.c ?? firstOfYear?.o ?? closes[0];
  const changeYtd = prevYearClose ? last / prevYearClose - 1 : 0;

  // Trend score: where price sits against its averages, how the averages slope, and momentum.
  let score = 0;
  const signals: string[] = [];
  if (s50) score += clamp(((last - s50) / s50) * 400, -20, 20);
  if (s200) score += clamp(((last - s200) / s200) * 200, -20, 20);
  if (s50 && s200) {
    score += s50 > s200 ? 12 : -12;
    const s50Arr = sma(closes, 50);
    const s200Arr = sma(closes, 200);
    for (let i = n - 1; i >= Math.max(1, n - 15); i--) {
      const a0 = s50Arr[i - 1];
      const b0 = s200Arr[i - 1];
      const a1 = s50Arr[i];
      const b1 = s200Arr[i];
      if (a0 == null || b0 == null || a1 == null || b1 == null) break;
      if (a0 <= b0 && a1 > b1) { signals.push("Golden cross (50-day crossed above 200-day) in the last 3 weeks"); break; }
      if (a0 >= b0 && a1 < b1) { signals.push("Death cross (50-day crossed below 200-day) in the last 3 weeks"); break; }
    }
  }
  score += clamp(slope(closes, 50) * 252 * 40, -20, 20);
  score += clamp(pctChange(closes, 21) * 150, -15, 15);
  if (m) score += m.hist > 0 ? 6 : -6;
  if (r != null) {
    if (r > 70) signals.push(`RSI ${r.toFixed(0)}: overbought, pullback risk`);
    else if (r < 30) signals.push(`RSI ${r.toFixed(0)}: oversold, bounce potential`);
  }
  if (m) {
    const prev = macd(closes)[n - 2];
    if (prev && prev.hist <= 0 && m.hist > 0) signals.push("MACD turned positive (bullish crossover)");
    if (prev && prev.hist >= 0 && m.hist < 0) signals.push("MACD turned negative (bearish crossover)");
  }
  if (bb) {
    if (bb.pctB > 1) signals.push("Closed above the upper Bollinger band (stretched)");
    if (bb.pctB < 0) signals.push("Closed below the lower Bollinger band (washed out)");
  }
  if (last >= high52 * 0.98) signals.push("Trading within 2% of its 52-week high");
  if (last <= low52 * 1.02) signals.push("Trading within 2% of its 52-week low");
  if (s200 && last > s200 && closes[n - 2] < s200) signals.push("Reclaimed its 200-day average today");
  if (s200 && last < s200 && closes[n - 2] > s200) signals.push("Broke below its 200-day average today");

  score = clamp(score, -100, 100);
  const { support, resistance } = supportResistance(bars);

  return {
    last,
    change1d: pctChange(closes, 1),
    change5d: pctChange(closes, 5),
    change1m: pctChange(closes, 21),
    change3m: pctChange(closes, 63),
    changeYtd,
    change1y: pctChange(closes, 252),
    sma20: s20,
    sma50: s50,
    sma200: s200,
    rsi14: r,
    macd: m,
    bollinger: bb,
    atr14: a,
    volAnnual,
    high52,
    low52,
    trend: classifyTrend(score),
    trendScore: Math.round(score),
    support,
    resistance,
    signals,
  };
}
