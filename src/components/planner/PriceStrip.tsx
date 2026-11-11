"use client";

import { useEffect, useState } from "react";
import { cheapestDayIndex, type DayPrice } from "@/lib/flights/priceStrip";
import type { Cabin } from "@/lib/flights/types";
import { formatUsd } from "@/lib/geo";

interface Props {
  from: string;
  to: string;
  date: string;
  adults: number;
  cabin: Cabin;
  /** Only the outbound flight can move the trip's start date. */
  editable: boolean;
  onPickDate: (date: string) => void;
}

interface Calendar {
  source: "travelpayouts" | "sample";
  days: DayPrice[];
  nearby?: DayPrice[];
  notices: string[];
}

const weekday = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const dayNum = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const PLACEHOLDER: DayPrice[] = Array.from({ length: 7 }, () => ({ date: "", price: null }));

/** The lowest price on each of the 7 days around the leg's date. */
export function PriceStrip({ from, to, date, adults, cabin, editable, onPickDate }: Props) {
  const key = `${from}|${to}|${date}|${adults}|${cabin}`;
  const [state, setState] = useState<{ key: string; data?: Calendar; failed?: boolean } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ from, to, date, adults: String(adults), cabin });
    fetch(`/api/flights/calendar?${qs}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("calendar failed");
        setState({ key, data: (await r.json()) as Calendar });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setState({ key, failed: true });
      });
    return () => ctrl.abort();
  }, [key, from, to, date, adults, cabin]);

  const current = state?.key === key ? state : null;
  if (current?.failed) return null;
  const data = current?.data;
  const days = data?.days;
  const low = days ? cheapestDayIndex(days) : -1;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-1.5" data-testid="price-strip">
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Lowest price each day, three days either side">
        {(days ?? PLACEHOLDER).map((d, i) => {
          const center = i === 3;
          const past = d.date !== "" && d.date < today;
          const canPick = editable && !center && !past && Boolean(days);
          const label = d.date ? `${dayNum(d.date)}${d.price !== null ? `, from ${formatUsd(d.price)}` : ", no price known"}` : "Loading";
          return (
            <button
              key={d.date || i}
              type="button"
              disabled={!canPick}
              aria-current={center ? "date" : undefined}
              aria-label={label}
              title={canPick ? `Fly on ${dayNum(d.date)} instead` : label}
              onClick={() => onPickDate(d.date)}
              className={`flex min-w-0 flex-col items-center rounded-md border px-0.5 py-1 text-center leading-tight transition-colors ${!days ? "skeleton" : ""} ${canPick ? "hover:border-[var(--accent)]" : ""}`}
              style={{
                borderColor: center ? "var(--accent)" : "var(--line)",
                background: center ? "var(--accent-soft)" : "transparent",
                cursor: canPick ? "pointer" : "default",
                opacity: past ? 0.45 : 1,
              }}
            >
              <span className="text-[10px] uppercase tracking-wide text-ink-3">{d.date ? weekday(d.date) : " "}</span>
              <span className="text-[11px] text-ink-2">{d.date ? d.date.slice(8).replace(/^0/, "") : " "}</span>
              <span
                className="data text-[11.5px]"
                style={{ color: i === low ? "var(--accent)" : d.price === null ? "var(--ink-3)" : "var(--ink)", fontWeight: i === low ? 600 : 400 }}
              >
                {days ? (d.price !== null ? formatUsd(d.price) : "—") : " "}
              </span>
            </button>
          );
        })}
      </div>
      {data?.nearby?.length ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2" data-testid="nearby-fares">
          <span>No recent fare for {dayNum(date)}. Closest:</span>
          {data.nearby.map((d) =>
            editable ? (
              <button key={d.date} type="button" className="chip chip-accent" title={`Fly on ${dayNum(d.date)} instead`} onClick={() => onPickDate(d.date)}>
                {weekday(d.date)} {dayNum(d.date)} · {formatUsd(d.price!)}
              </button>
            ) : (
              <span key={d.date} className="chip chip-muted">{weekday(d.date)} {dayNum(d.date)} · {formatUsd(d.price!)}</span>
            ),
          )}
        </div>
      ) : null}
      <p className="text-[11.5px] leading-snug text-ink-3">
        {editable
          ? "Tap a day to move your departure. Every later city shifts with it."
          : "For information only. This flight's date comes from the nights you spend in each city."}
        {data?.notices.length ? ` ${data.notices.join(" ")}` : ""}
      </p>
    </div>
  );
}
