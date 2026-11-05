"use client";

import { useLayoutEffect, useState } from "react";
import { FLAP_DEFAULTS, flapDuration, flapFrame, flapPlan } from "@/lib/splitflap";
import "./SplitFlap.css";

interface Props {
  /** Short text: an airport code, a time, a flight number. */
  value: string;
  size?: "sm" | "md" | "lg";
  /** Warm white (default) or brass characters. */
  tone?: "light" | "brass";
  /** Wait this long before flipping, so several boards can ripple in sequence. */
  delayMs?: number;
  /** Spoken text, if it should differ from `value`. */
  label?: string;
  className?: string;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A departure-board display: each character sits on its own flap and clicks
 * through a few characters into place, left to right, whenever the value
 * changes (and on first show). Screen readers get the plain text; with
 * reduced motion the final text shows straight away.
 */
export function SplitFlap({ value, size = "md", tone = "light", delayMs = 0, label, className = "" }: Props) {
  // The animation's current frame, tagged with the value it is animating
  // towards. Any other time (reduced motion, before the first frame) the
  // value itself shows.
  const [frame, setFrame] = useState<{ of: string; chars: string[] } | null>(null);

  // A layout effect, so the first scrambled frame replaces the final text before the browser paints.
  useLayoutEffect(() => {
    if (reducedMotion()) return;
    const flipMs = FLAP_DEFAULTS.flipMs;
    const plan = flapPlan(value, { delayMs });
    const end = flapDuration(plan, flipMs);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      const chars = flapFrame(plan, t, flipMs);
      setFrame((f) => (f?.of === value && f.chars.every((c, i) => c === chars[i]) ? f : { of: value, chars }));
      if (t < end) raf = requestAnimationFrame(tick);
    };
    tick(t0);
    return () => cancelAnimationFrame(raf);
  }, [value, delayMs]);

  const chars = frame?.of === value ? frame.chars : Array.from(value);
  return (
    <span role="img" aria-label={label ?? value} className={`sf sf-${size} ${tone === "brass" ? "sf-brass" : ""} ${className}`}>
      {chars.map((ch, i) => (
        <Flap key={i} ch={ch} />
      ))}
    </span>
  );
}

/** One cell. When its character changes, the old top half folds down over the new one. */
function Flap({ ch }: { ch: string }) {
  const [state, setState] = useState({ cur: ch, prev: ch, n: 0 });
  if (state.cur !== ch) setState({ cur: ch, prev: state.cur, n: state.n + 1 });
  const { cur, prev, n } = state.cur === ch ? state : { cur: ch, prev: state.cur, n: state.n + 1 };

  if (ch === " ") return <span className="sf-cell sf-gap" aria-hidden />;
  return (
    <span className="sf-cell" aria-hidden>
      <span className="sf-half sf-top"><span>{cur}</span></span>
      <span className="sf-half sf-bottom"><span>{n ? prev : cur}</span></span>
      {n > 0 && (
        <>
          <span key={`f${n}`} className="sf-half sf-top sf-fold"><span>{prev}</span></span>
          <span key={`l${n}`} className="sf-half sf-bottom sf-land"><span>{cur}</span></span>
        </>
      )}
    </span>
  );
}
