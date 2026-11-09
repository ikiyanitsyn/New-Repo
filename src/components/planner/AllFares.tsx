"use client";

import { formatUsd } from "@/lib/geo";
import type { FareQuote } from "@/lib/flights/batch";
import { PlaneLoader } from "../PlaneLoader";
import { BoltIcon, PlaneIcon } from "../icons";

export interface AllFaresState {
  quotes: Record<string, FareQuote>;
  running: null | { live: boolean; done: number; total: number };
  liveLeft: number | null;
  liveAvailable: boolean;
  onSearchAll: (live: boolean) => void;
}

/** One place to price every flight in the trip at once. */
export function AllFares({ count, state }: { count: number; state: AllFaresState }) {
  if (count === 0) return null;
  const priced = Object.keys(state.quotes).length;
  const total = Object.values(state.quotes).reduce((n, q) => n + q.cheapest, 0);
  const allLive = priced > 0 && Object.values(state.quotes).every((q) => q.live);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line px-3.5 py-3" style={{ background: "var(--surface-sunk)" }}>
      <div className="flex items-center gap-2 text-[13.5px] font-medium">
        <PlaneIcon size={15} className="text-accent" />
        {count} {count === 1 ? "flight" : "flights"} in this trip
        {priced > 0 && <span className="data ml-auto text-[12.5px] text-ink-2">from {formatUsd(total)} total</span>}
      </div>
      {state.running ? (
        <div className="flex items-center gap-3 text-[12.5px] text-ink-2">
          <PlaneLoader label="Searching flights" />
          {state.running.live ? "Checking live prices" : "Finding fares"} · {state.running.done}/{state.running.total}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn !h-8 !text-[12.5px]" onClick={() => state.onSearchAll(false)}>
            {priced ? "Refresh fares for all" : "Find fares for all flights"}
          </button>
          {state.liveAvailable && !allLive && (
            <button type="button" className="btn btn-primary !h-8 !text-[12.5px]" onClick={() => state.onSearchAll(true)}>
              <BoltIcon size={13} /> Live prices for all · uses {count}
              {state.liveLeft !== null ? ` of ${state.liveLeft} left` : ""}
            </button>
          )}
        </div>
      )}
      <p className="text-[11.5px] text-ink-3">
        One search covers every flight. Each leg&apos;s results are kept for 12 hours, so opening a flight afterwards costs nothing.
      </p>
    </div>
  );
}

export function QuoteLine({ quote }: { quote?: FareQuote }) {
  if (!quote) return <span className="text-accent">Compare fares</span>;
  return (
    <>
      <span className="data block">from {formatUsd(quote.cheapest)}</span>
      <span className="text-ink-3">{quote.live ? "live" : quote.source === "sample" ? "sample" : "recent"} · best {formatUsd(quote.best)}</span>
    </>
  );
}
