"use client";

import { useState } from "react";
import { describeFilter, isDefaultFilter, NO_LAYOVER_FILTER, type LayoverFilter } from "@/lib/flights/layover";
import { DownIcon, UpIcon } from "../icons";

interface Props {
  filter: LayoverFilter;
  onChange: (f: LayoverFilter) => void;
  /** Connection airports found in the current results. */
  airports: { code: string; count: number }[];
}

const MIN_OPTIONS = [1, 2, 3, 4];
const MAX_OPTIONS = [2, 3, 4, 6, 8, 12];

const STOP_CHOICES: { label: string; value: LayoverFilter["maxStops"] }[] = [
  { label: "Nonstop", value: 0 },
  { label: "Up to 1 stop", value: 1 },
  { label: "Any", value: null },
];

/** Max stops, layover length and preferred connection airports. */
export function LayoverControls({ filter, onChange, airports }: Props) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<LayoverFilter>) => onChange({ ...filter, ...patch });
  const toggleAirport = (code: string) =>
    set({ airports: filter.airports.includes(code) ? filter.airports.filter((a) => a !== code) : [...filter.airports, code] });
  const extras = (filter.minHours !== null || filter.maxHours !== null ? 1 : 0) + (filter.airports.length ? 1 : 0);

  return (
    <div className="flex flex-col gap-2" data-testid="layover-controls">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="segmented" role="group" aria-label="Maximum stops">
          {STOP_CHOICES.map((c) => (
            <button key={c.label} type="button" aria-pressed={filter.maxStops === c.value} onClick={() => set({ maxStops: c.value })}>
              {c.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost !h-8 !px-2 !text-[12.5px]"
          aria-expanded={open}
          aria-controls="layover-panel"
          onClick={() => setOpen((o) => !o)}
        >
          Layovers{extras > 0 && <span className="chip chip-accent !h-4 !px-1.5 !text-[10px]">{extras}</span>}
          {open ? <UpIcon size={13} /> : <DownIcon size={13} />}
        </button>
      </div>

      {open && (
        <div id="layover-panel" className="flex flex-col gap-3 rounded-md border border-line px-3 py-3" style={{ background: "var(--surface-sunk)" }}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
            <span className="text-ink-2">Layover length</span>
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Shortest layover</span>
              <select
                className="field !h-8 !w-auto !text-[13px]"
                value={filter.minHours ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  set({ minHours: v, ...(v !== null && filter.maxHours !== null && v >= filter.maxHours ? { maxHours: null } : {}) });
                }}
              >
                <option value="">Any min</option>
                {MIN_OPTIONS.map((h) => <option key={h} value={h}>at least {h} h</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Longest layover</span>
              <select
                className="field !h-8 !w-auto !text-[13px]"
                value={filter.maxHours ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  set({ maxHours: v, ...(v !== null && filter.minHours !== null && v <= filter.minHours ? { minHours: null } : {}) });
                }}
              >
                <option value="">Any max</option>
                {MAX_OPTIONS.map((h) => <option key={h} value={h}>at most {h} h</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-2">Preferred connection airports</span>
            {airports.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preferred connection airports">
                {airports.map((a) => {
                  const on = filter.airports.includes(a.code);
                  return (
                    <button
                      key={a.code}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleAirport(a.code)}
                      className="chip data cursor-pointer"
                      style={{ background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--ink-2)", border: `1px solid ${on ? "var(--accent)" : "var(--line-strong)"}` }}
                      title={`${a.count} fare${a.count === 1 ? "" : "s"} connect here`}
                    >
                      {a.code}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-ink-3">Connection airports appear here when the fares list them. Cached fares only give the number of stops.</p>
            )}
          </div>

          {!isDefaultFilter(filter) && (
            <div className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
              <span>{describeFilter(filter)}</span>
              <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => onChange(NO_LAYOVER_FILTER)}>Reset</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
