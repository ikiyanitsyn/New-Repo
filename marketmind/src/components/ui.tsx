"use client";
import Link from "next/link";
import type { Outlook, TrendState } from "@/lib/types";
import { arrow, dirClass, displaySymbol, fmtPct, symbolHref } from "@/lib/client/format";

export function Change({ value, digits = 2, className = "" }: { value: number | null | undefined; digits?: number; className?: string }) {
  if (value == null) return <span className="muted">—</span>;
  return (
    <span className={`num ${dirClass(value)} ${className}`}>
      <span aria-hidden className="mr-0.5 text-[0.7em]">{arrow(value)}</span>
      {fmtPct(value, digits)}
    </span>
  );
}

const TREND: Record<TrendState, [string, string]> = {
  "strong-up": ["Strong uptrend", "chip-up"],
  up: ["Uptrend", "chip-up"],
  sideways: ["Range-bound", ""],
  down: ["Downtrend", "chip-down"],
  "strong-down": ["Strong downtrend", "chip-down"],
};

export function TrendChip({ trend }: { trend: TrendState }) {
  const [label, cls] = TREND[trend];
  return (
    <span className={`chip ${cls}`}>
      <span aria-hidden>{trend.includes("up") ? "↗" : trend.includes("down") ? "↘" : "→"}</span>
      {label}
    </span>
  );
}

export function StanceChip({ stance, score }: { stance: Outlook["stance"]; score?: number }) {
  const cls = stance.includes("Bullish") ? "chip-up" : stance.includes("Bearish") ? "chip-down" : "";
  return (
    <span className={`chip ${cls}`}>
      <span aria-hidden>{stance.includes("Bullish") ? "▲" : stance.includes("Bearish") ? "▼" : "■"}</span>
      {stance}
      {score != null && <span className="num opacity-75">{score > 0 ? `+${score}` : score}</span>}
    </span>
  );
}

export function ScoreChip({ score, label }: { score: number; label?: string }) {
  const cls = score > 8 ? "chip-up" : score < -8 ? "chip-down" : "";
  return (
    <span className={`chip num ${cls}`} title={label}>
      {arrow(score)} {score > 0 ? `+${score}` : score}
    </span>
  );
}

export function DataBadge({ mode }: { mode: "live" | "mixed" | "sample" | string }) {
  if (mode === "live" || mode === "yahoo" || mode === "stooq")
    return (
      <span className="chip chip-up" title="Prices from Yahoo Finance or Stooq; may be delayed">
        <span aria-hidden>●</span> Live data
      </span>
    );
  if (mode === "mixed")
    return (
      <span className="chip chip-warn" title="Some prices could not be fetched live and are sample data">
        <span aria-hidden>◐</span> Partly sample data
      </span>
    );
  return (
    <span className="chip chip-warn" title="Live sources were unreachable, so these are illustrative sample prices">
      <span aria-hidden>○</span> Sample data
    </span>
  );
}

export function SymbolLink({ symbol, name, className = "" }: { symbol: string; name?: string; className?: string }) {
  return (
    <Link href={symbolHref(symbol)} className={`hover:underline ${className}`}>
      <span className="font-semibold">{displaySymbol(symbol)}</span>
      {name && name !== symbol && <span className="ml-1.5 soft">{name}</span>}
    </Link>
  );
}

export function Card({ title, right, children, className = "" }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="card-h">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ h = 16, w = "100%", className = "" }: { h?: number; w?: number | string; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height: h, width: w }} />;
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="card flex items-center justify-between gap-3 p-4 text-sm">
      <span>
        <span aria-hidden className="down mr-1">⚠</span>
        {text}
      </span>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** A horizontal bar for a signed score from -100 to 100, drawn from a centre baseline. */
export function DivergingBar({ value, max = 100 }: { value: number; max?: number }) {
  const w = Math.min(Math.abs(value) / max, 1) * 50;
  return (
    <div className="relative h-2 w-full rounded-full" style={{ background: "var(--neutral-mid)" }} aria-hidden>
      <div className="absolute top-0 h-2 w-px" style={{ left: "50%", background: "var(--line-strong)" }} />
      <div
        className="absolute top-0 h-2 rounded-full"
        style={{ width: `${w}%`, left: value >= 0 ? "50%" : `${50 - w}%`, background: value >= 0 ? "var(--up-fill)" : "var(--down-fill)" }}
      />
    </div>
  );
}
