"use client";

import { useEffect, useRef, useState } from "react";
import { estimateLeg, MODES, type Mode } from "@/lib/ground";
import { formatDuration, formatMiles, formatUsd } from "@/lib/geo";
import { fmtDay } from "@/lib/format";
import type { FlightPick, Leg, Trip } from "@/lib/trip";
import { FlightResults } from "./FlightResults";
import { ExternalIcon, MODE_ICON, MODE_LABEL } from "./icons";
import { CollapseButton } from "./planner/CollapseButton";

interface Props {
  leg: Leg | undefined;
  trip: Trip;
  onMode: (legId: string, mode: Mode) => void;
  onPick: (legId: string, pick: FlightPick | null) => void;
  /** Move the trip's departure date (price strip on the outbound flight). */
  onDate?: (date: string) => void;
  /** After a fare is chosen: go to the next leg that needs a flight. Returns false when none is left. */
  onNextLeg?: (fromLegId: string) => boolean;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}

/** How long the "Added to your trip" note stays, and how long before the next leg opens. */
const TOAST_MS = 3200;
const ADVANCE_MS = 1100;

export function LegPanel({ leg, trip, onMode, onPick, onDate, onNextLeg, collapsed = false, onCollapse, onExpand }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const nextRef = useRef(onNextLeg);
  useEffect(() => {
    nextRef.current = onNextLeg;
  });
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const choose = (legId: string, pick: FlightPick | null) => {
    onPick(legId, pick);
    if (!pick) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    setToast(`Added to your trip \u00b7 ${formatUsd(pick.priceTotal)}`);
    timers.current = [
      window.setTimeout(() => {
        const moved = nextRef.current?.(legId);
        if (moved === false) setToast((t) => (t ? `${t} \u00b7 all flights chosen` : t));
      }, ADVANCE_MS),
      window.setTimeout(() => setToast(null), TOAST_MS),
    ];
  };

  return (
    <>
      <section id="leg-panel" className="panel results scroll-mt-4" aria-label="Leg details" data-collapsed={collapsed}>
        {!leg ? (
          <div className="flex flex-col gap-2 px-5 py-6">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Fares and transfers</span>
              {onCollapse && <CollapseButton onClick={onCollapse} />}
            </div>
            <p className="text-[14px] text-ink-2">Choose a flight or a leg between cities to compare options.</p>
          </div>
        ) : leg.mode === "flight" ? (
          <>
            {leg.kind === "between" && <ModeCompare leg={leg} adults={trip.adults} onMode={(m) => onMode(leg.id, m)} compact />}
            <FlightResults
              key={`${leg.id}|${leg.from.code}|${leg.to.code}|${leg.date}|${trip.adults}|${trip.cabin}`}
              leg={leg}
              trip={trip}
              pick={trip.picks?.[leg.id]}
              onPick={(p) => choose(leg.id, p)}
              onPickDate={onDate}
              onCollapse={onCollapse}
            />
          </>
        ) : (
          <GroundDetail leg={leg} adults={trip.adults} onMode={(m) => onMode(leg.id, m)} onCollapse={onCollapse} />
        )}
        {toast && (
          <div role="status" className="results-toast">
            {toast}
          </div>
        )}
      </section>
      {collapsed && (
        <button type="button" className="results-tab" onClick={onExpand} aria-label="Show fares and transfers" title="Show fares">
          <span className="results-tab-label">Fares</span>
        </button>
      )}
    </>
  );
}

function GroundDetail({ leg, adults, onMode, onCollapse }: { leg: Leg; adults: number; onMode: (m: Mode) => void; onCollapse?: () => void }) {
  const est = estimateLeg(leg.from, leg.to, leg.mode);
  const Icon = MODE_ICON[leg.mode];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-2 border-b border-line px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Between stops</span>
          <span className="flex items-center gap-1.5">
            <span className={`chip ${est.source === "typical" ? "chip-ground" : "chip-muted"}`}>
              {est.source === "typical" ? "Typical schedule" : "Estimate"}
            </span>
            {onCollapse && <CollapseButton onClick={onCollapse} />}
          </span>
        </div>
        <h2 className="display text-[26px] leading-tight">
          {leg.from.name} <span className="text-ink-3">to</span> {leg.to.name}
        </h2>
        <p className="data text-[12px] text-ink-2">{fmtDay(leg.date)} · {formatMiles(est.distanceKm)} as the crow flies</p>
      </header>

      <div className="scroll-y flex min-h-0 flex-1 flex-col gap-5 px-5 py-4">
        <div className="flex items-center gap-4 rounded-lg border border-[var(--ground)] px-4 py-3" style={{ background: "var(--ground-soft)" }}>
          <Icon size={26} className="flex-none text-ground" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">{MODE_LABEL[leg.mode]}{est.notes[0] && est.source === "typical" ? ` · ${est.notes[0]}` : ""}</div>
            <div className="data text-[20px] leading-tight">{formatDuration(est.durationMin)}</div>
          </div>
          <div className="text-right">
            <div className="data text-[18px]">~{formatUsd(est.priceBasis === "per person" ? est.priceUsd * adults : est.priceUsd)}</div>
            <div className="text-[11.5px] text-ink-3">{est.priceBasis === "per person" && adults > 1 ? `${formatUsd(est.priceUsd)} each` : est.priceBasis}</div>
          </div>
        </div>

        {est.notes.length > (est.source === "typical" ? 1 : 0) && (
          <ul className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            {est.notes.slice(est.source === "typical" ? 1 : 0).map((n) => (
              <li key={n} className="flex gap-2"><span className="mt-[7px] h-1 w-1 flex-none rounded-full" style={{ background: "var(--ground)" }} />{n}</li>
            ))}
          </ul>
        )}

        <ModeCompare leg={leg} adults={adults} onMode={onMode} />

        <p className="text-[12px] text-ink-3">
          Times and fares are planning figures from typical timetables, not live prices. Live routes and timetables come later.
        </p>
      </div>

      {est.bookLinks.length > 0 && (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-5 py-3 text-[12.5px]">
          <span className="text-ink-3">Book on</span>
          {est.bookLinks.map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-2 underline decoration-[var(--line-strong)] underline-offset-2 hover:text-ink">
              {l.label} <ExternalIcon size={11} />
            </a>
          ))}
        </footer>
      )}
    </div>
  );
}

function ModeCompare({ leg, adults, onMode, compact }: { leg: Leg; adults: number; onMode: (m: Mode) => void; compact?: boolean }) {
  const rows = MODES.map((m) => estimateLeg(leg.from, leg.to, m));
  const fastest = Math.min(...rows.map((r) => r.durationMin + (r.mode === "flight" ? 150 : 0)));
  return (
    <div className={compact ? "border-b border-line px-5 py-3" : ""}>
      <div className="eyebrow mb-2">{compact ? "Or travel overland" : "Compare ways to go"}</div>
      <table className="w-full text-[13px]">
        <thead className="sr-only">
          <tr><th>Mode</th><th>Time</th><th>Cost</th><th></th></tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => !compact || r.mode !== "flight")
            .filter((r) => !(r.mode === "ferry" && leg.from.country === leg.to.country && r.distanceKm > 300))
            .map((r) => {
              const Icon = MODE_ICON[r.mode];
              const door = r.durationMin + (r.mode === "flight" ? 150 : 0);
              const on = leg.mode === r.mode;
              return (
                <tr key={r.mode} className="border-t border-line first:border-t-0">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <Icon size={15} className={on ? "text-ground" : "text-ink-3"} />
                      {MODE_LABEL[r.mode]}
                      {door === fastest && <span className="chip chip-muted !h-5 !text-[10.5px]">Fastest door to door</span>}
                    </span>
                  </td>
                  <td className="data py-1.5 text-right">{formatDuration(r.durationMin)}</td>
                  <td className="data py-1.5 text-right text-ink-2">~{formatUsd(r.priceBasis === "per person" ? r.priceUsd * adults : r.priceUsd)}</td>
                  <td className="py-1.5 pl-2 text-right">
                    {on ? (
                      <span className="text-[12px] text-ink-3">Selected</span>
                    ) : (
                      <button type="button" className="btn !h-7 !px-2.5 !text-[12px]" onClick={() => onMode(r.mode)}>Use</button>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
