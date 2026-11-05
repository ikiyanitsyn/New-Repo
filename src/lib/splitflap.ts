/**
 * Timing for the split-flap (departure board) display. Pure functions, so the
 * component only has to ask "what does each cell show at time t?".
 */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

export interface FlapOptions {
  /** Time per flip, ms. */
  flipMs?: number;
  /** Delay between one cell starting and the next, ms. */
  staggerMs?: number;
  /** How many characters a cell flips through before settling. */
  flips?: number;
  /** Delay before the first cell starts, ms. */
  delayMs?: number;
  /** No cell may still be moving after this long (ms from its start, delay excluded). */
  maxMs?: number;
}

export interface FlapCell {
  /** Characters shown in turn; the last one is the final character. */
  seq: string[];
  /** When this cell starts flipping, ms. */
  start: number;
}

export const FLAP_DEFAULTS = { flipMs: 48, staggerMs: 45, flips: 6, delayMs: 0, maxMs: 650 } as const;

/**
 * The characters a cell passes through to reach `target`, like a real board:
 * the `flips` characters just before it on the drum (letters cycle through
 * letters, digits through digits), then the target. Anything else (spaces,
 * colons, arrows) doesn't flip.
 */
export function flapSequence(target: string, flips: number): string[] {
  const ch = target.toUpperCase();
  const drum = LETTERS.includes(ch) ? LETTERS : DIGITS.includes(ch) ? DIGITS : null;
  if (!drum || flips <= 0) return [target];
  const i = drum.indexOf(ch);
  const n = Math.min(flips, drum.length - 1);
  const seq: string[] = [];
  for (let k = n; k >= 1; k--) seq.push(drum[(i - k + drum.length * 2) % drum.length]);
  seq.push(target);
  return seq;
}

/** Plan every cell of `value`: what it flips through and when it starts, staggered left to right. */
export function flapPlan(value: string, opts: FlapOptions = {}): FlapCell[] {
  const { flipMs, staggerMs, flips, delayMs, maxMs } = { ...FLAP_DEFAULTS, ...opts };
  return Array.from(value).map((ch, i) => {
    const start = i * staggerMs;
    // Vary the count a little so the board doesn't move in lockstep, but never run past maxMs.
    const want = flips + (i % 2);
    const room = Math.max(0, Math.floor((maxMs - start) / flipMs));
    return { seq: flapSequence(ch, Math.min(want, room)), start: delayMs + start };
  });
}

/** Total running time of a plan, ms. */
export function flapDuration(plan: FlapCell[], flipMs: number = FLAP_DEFAULTS.flipMs): number {
  return plan.reduce((m, c) => Math.max(m, c.start + (c.seq.length - 1) * flipMs), 0);
}

/** What each cell shows `t` ms after the animation began. */
export function flapFrame(plan: FlapCell[], t: number, flipMs: number = FLAP_DEFAULTS.flipMs): string[] {
  return plan.map(({ seq, start }) => {
    const k = Math.floor((t - start) / flipMs);
    return seq[Math.max(0, Math.min(seq.length - 1, k))];
  });
}
