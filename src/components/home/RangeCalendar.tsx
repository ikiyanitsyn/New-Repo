"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon } from "../icons";
import {
  addMonths,
  dayState,
  isBefore,
  monthGrid,
  monthKey,
  monthOf,
  moveFocus,
  nights,
  pickDay,
  rangeProblem,
  type CalendarMode,
  type DateRange,
} from "./rangeCalendar";
import s from "./RangeCalendar.module.css";

/*
 * An accessible range calendar: two months side by side on desktop, one on
 * phones (where it opens as a full-screen sheet). Arrow keys move by day and
 * week, Home/End to the week's ends, PageUp/PageDown by month (Shift for a year),
 * Enter or Space picks, Escape closes. No date library: the logic is in
 * rangeCalendar.ts and unit-tested.
 */

interface Props {
  mode: CalendarMode;
  value: DateRange;
  /** Earliest day you can pick (today). */
  min: string;
  onChange: (range: DateRange) => void;
  /** Called with the final range when a pick completes it (single mode), else with nothing. */
  onClose: (final?: DateRange) => void;
  /** Extra line under the summary, e.g. "Includes 2 nights in Reykjavík". */
  note?: string;
  /** Shown while choosing the return, e.g. "Back from Beijing". */
  label?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const monthTitle = (key: string) =>
  new Date(key + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const longDay = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDay = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function RangeCalendar({ mode, value, min, onChange, onClose, note, label }: Props) {
  const ids = useId();
  const minMonth = min.slice(0, 7);
  const [view, setView] = useState(() => (value.start ?? min).slice(0, 7));
  const [focusDay, setFocusDay] = useState(() => value.start ?? min);
  const [hover, setHover] = useState<string | undefined>();
  const gridRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  // After keyboard movement, put focus on the newly active day.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, view]);

  // On open, bring the whole calendar into view and focus the departure day (or today).
  useEffect(() => {
    gridRef.current?.closest("[role=dialog]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${focusDay}"]`)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const months = [view, addMonths(view, 1)];
  const problem = rangeProblem(value, mode, min);
  const choosingReturn = mode === "range" && !!value.start && !value.end;

  const pick = (day: string) => {
    if (isBefore(day, min)) return;
    const next = pickDay(value, day, mode);
    onChange(next);
    setFocusDay(day);
    if (mode === "single") onClose(next);
  };

  const onKey = (e: React.KeyboardEvent, day: string) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    const to = moveFocus(day, e.key, e.shiftKey);
    if (!to) return;
    e.preventDefault();
    const target = isBefore(to, min) ? min : to;
    const key = target.slice(0, 7);
    // Keep the active day visible: page the view when it leaves both months.
    if (key < view) setView(key);
    else if (key > addMonths(view, 1)) setView(addMonths(key, -1));
    // On phones only the first month shows, so follow the day there too.
    if (window.matchMedia("(max-width: 600px)").matches && key !== view) setView(key);
    moved.current = true;
    setFocusDay(target);
    if (choosingReturn) setHover(target);
  };

  const summary = (() => {
    if (!value.start) return mode === "single" ? "Choose a departure date" : "Choose your departure date";
    if (mode === "single") return shortDay(value.start);
    if (!value.end) return `${shortDay(value.start)} → choose a return date`;
    const n = nights(value.start, value.end);
    return `${shortDay(value.start)} → ${shortDay(value.end)} · ${n} ${n === 1 ? "night" : "nights"}`;
  })();

  return (
    <>
      <div className={s.scrim} onClick={() => onClose()} aria-hidden />
      <div
        className={s.calendar}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
      >
        <div className={s.head}>
          <h2 id={`${ids}-title`} className={s.title}>
            {mode === "single" ? "Departure date" : choosingReturn ? (label ?? "Return date") : "Departure → return"}
          </h2>
          <button type="button" className={`btn btn-ghost btn-icon ${s.close}`} onClick={() => onClose()} aria-label="Close calendar">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className={s.nav}>
          <button type="button" className={`btn btn-ghost btn-icon ${s.navBtn}`} onClick={() => setView(addMonths(view, -1))} disabled={view <= minMonth} aria-label="Previous month">
            ‹
          </button>
          <button type="button" className={`btn btn-ghost btn-icon ${s.navBtn}`} onClick={() => setView(addMonths(view, 1))} aria-label="Next month">
            ›
          </button>
        </div>

        <div className={s.months} ref={gridRef} onMouseLeave={() => setHover(undefined)}>
          {months.map((key, mi) => {
            const { year, month } = monthOf(key + "-01");
            const titleId = `${ids}-m${mi}`;
            return (
              <div key={key} className={s.month} data-second={mi === 1 || undefined}>
                <div className={`display ${s.monthTitle}`} id={titleId} aria-live={mi === 0 ? "polite" : undefined}>{monthTitle(monthKey(year, month))}</div>
                <table className={s.grid} role="grid" aria-labelledby={titleId}>
                  <thead>
                    <tr>
                      {WEEKDAYS.map((w, i) => <th key={w} scope="col" abbr={WEEKDAYS_LONG[i]}>{w}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {monthGrid(key).map((week, wi) => (
                      <tr key={wi}>
                        {week.map((day, di) => {
                          if (!day) return <td key={di} className={s.blank} />;
                          const state = dayState(day, value, mode, choosingReturn ? hover : undefined);
                          const past = isBefore(day, min);
                          const tag = state === "start" || (state === "single" && mode === "range") ? ", departure" : state === "end" ? ", return" : state === "single" ? ", selected" : "";
                          return (
                            <td key={di} className={s.cell} data-state={state} role="gridcell" aria-selected={state !== "none"}>
                              <button
                                type="button"
                                data-day={day}
                                className={s.day}
                                tabIndex={day === focusDay ? 0 : -1}
                                disabled={past}
                                aria-label={`${longDay(day)}${tag}`}
                                aria-current={day === min ? "date" : undefined}
                                onClick={() => pick(day)}
                                onKeyDown={(e) => onKey(e, day)}
                                onMouseEnter={() => choosingReturn && setHover(day)}
                                onFocus={() => setFocusDay(day)}
                              >
                                {Number(day.slice(8))}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className={s.foot}>
          <div className={s.summary}>
            <span className="data" aria-live="polite">{summary}</span>
            {note && <span className={s.note}>{note}</span>}
          </div>
          <div className={s.actions}>
            {(value.start || value.end) && mode === "range" && (
              <button type="button" className="btn btn-ghost" onClick={() => { onChange({}); setHover(undefined); }}>Clear</button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => onClose()} disabled={!!problem}>
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
