"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findCity } from "@/lib/cities";
import { fmtDay } from "@/lib/format";
import {
  dayIndexByDate, insertItem, moveItem, moveToDay, removeItem, replaceItem, slotToIndex, usedPlaceNames,
  type ItemRef,
} from "@/lib/ai/edit";
import type { PlanItem, PlanResponse, SavedPlan, SwapOption } from "@/lib/ai/schema";
import type { Trip } from "@/lib/trip";
import { AddItemForm } from "./AddItemForm";
import { dayChoiceLabel, ItemRow } from "./ItemRow";
import { SwapPanel } from "./SwapPanel";
import { useDragSort } from "./useDragSort";
import { ratingKey, useKnownRatings } from "./useKnownRatings";
import { PlusIcon } from "../icons";
import styles from "./edit.module.css";

interface Props {
  resp: PlanResponse;
  plan: SavedPlan;
  trip: Trip;
  /** Turned off while a new plan is being written. */
  editable: boolean;
  /** Every edit goes through here (the Concierge dispatches `planResponse`). */
  onChange: (next: PlanResponse) => void;
  onOpenCity: (cityCode: string) => void;
  onOpenPlace?: (cityCode: string, placeName: string) => void;
}

const UNDO_MS = 7000;

/** A stable id per item object, so a row (and keyboard focus) survives being moved. */
const rowKeys = new WeakMap<PlanItem, string>();
let rowCount = 0;
function keyOf(it: PlanItem): string {
  let k = rowKeys.get(it);
  if (!k) rowKeys.set(it, (k = `i${rowCount++}`));
  return k;
}

interface Undo {
  date: string;
  index: number;
  item: PlanItem;
}

/** The day-by-day view: grouped by city, with drag, move, delete (with undo), add and swap. */
export function PlanDays({ resp, plan, trip, editable, onChange, onOpenCity, onOpenPlace }: Props) {
  const ratings = useKnownRatings(resp);
  const [panel, setPanel] = useState<{ item: PlanItem; kind: "menu" | "swap" } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [announce, setAnnounce] = useState("");
  const respRef = useRef(resp);
  const focusAfter = useRef<PlanItem | null>(null);

  useEffect(() => {
    respRef.current = resp;
  });

  const commit = useCallback(
    (next: PlanResponse, message: string) => {
      if (next === respRef.current) return;
      respRef.current = next;
      onChange(next);
      setAnnounce(message);
    },
    [onChange],
  );

  const locate = useCallback((it: PlanItem): ItemRef | null => {
    const days = respRef.current.days;
    for (let d = 0; d < days.length; d++) {
      const i = days[d].items.indexOf(it);
      if (i >= 0) return { day: d, index: i };
    }
    return null;
  }, []);

  const where = (r: PlanResponse, it: PlanItem) => {
    for (let d = 0; d < r.days.length; d++) {
      const i = r.days[d].items.indexOf(it);
      if (i >= 0) return `Day ${d + 1}, position ${i + 1} of ${r.days[d].items.length}`;
    }
    return "";
  };

  // Keep keyboard focus on the moved item's handle (a move to another day re-creates the row).
  useLayoutEffect(() => {
    const it = focusAfter.current;
    if (!it) return;
    focusAfter.current = null;
    document.querySelector<HTMLElement>(`[data-handle-for="${keyOf(it)}"]`)?.focus();
  });

  // ---- undo timer
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo]);

  // ---- drag
  const { drag, start } = useDragSort(
    useCallback(
      (from, to) => {
        const cur = respRef.current;
        const item = cur.days[from.day]?.items[from.index];
        if (!item) return;
        const next = moveItem(cur, from, { day: to.day, index: slotToIndex(from, to.day, to.slot) });
        commit(next, `Moved to ${where(next, item)}.`);
      },
      [commit],
    ),
  );

  const moveBy = useCallback(
    (item: PlanItem, dir: -1 | 1) => {
      const ref = locate(item);
      if (!ref) return;
      const cur = respRef.current;
      // At the top or bottom of a day, keep going into the neighbouring day.
      let next: PlanResponse;
      if (dir === -1 && ref.index === 0 && ref.day > 0) next = moveItem(cur, ref, { day: ref.day - 1, index: cur.days[ref.day - 1].items.length });
      else if (dir === 1 && ref.index === cur.days[ref.day].items.length - 1 && ref.day < cur.days.length - 1) next = moveItem(cur, ref, { day: ref.day + 1, index: 0 });
      else next = moveItem(cur, ref, { day: ref.day, index: ref.index + dir });
      if (next === cur) {
        setAnnounce(dir === -1 ? "Already first." : "Already last.");
        return;
      }
      focusAfter.current = item;
      commit(next, `Moved to ${where(next, item)}.`);
    },
    [commit, locate],
  );

  const onHandleKey = (item: PlanItem) => (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      moveBy(item, e.key === "ArrowUp" ? -1 : 1);
    }
  };

  // ---- actions
  function remove(item: PlanItem) {
    const ref = locate(item);
    if (!ref) return;
    const cur = respRef.current;
    const { response, removed } = removeItem(cur, ref);
    if (!removed) return;
    setPanel(null);
    setUndo({ date: cur.days[ref.day].date, index: ref.index, item: removed });
    commit(response, `Removed ${removed.title}. Undo is available for a few seconds.`);
  }

  function undoRemove() {
    if (!undo) return;
    const cur = respRef.current;
    const day = dayIndexByDate(cur, undo.date);
    setUndo(null);
    if (day < 0) return;
    focusAfter.current = undo.item;
    commit(insertItem(cur, day, undo.item, undo.index), `Restored ${undo.item.title}.`);
  }

  function add(dayIndex: number, item: PlanItem) {
    const next = insertItem(respRef.current, dayIndex, item);
    setAdding(null);
    commit(next, `Added ${item.title} to ${where(next, item)}.`);
  }

  function pickSwap(item: PlanItem, o: SwapOption) {
    const ref = locate(item);
    setPanel(null);
    if (!ref) return;
    const replacement: PlanItem = {
      time: item.time,
      title: o.title,
      kind: o.kind,
      ...(o.placeName ? { placeName: o.placeName } : {}),
      ...(o.note ? { note: o.note } : {}),
    };
    const next = replaceItem(respRef.current, ref, replacement);
    focusAfter.current = replacement;
    commit(next, `Swapped for ${o.title}.`);
  }

  const dayChoices = useMemo(
    () => resp.days.map((d, i) => ({ index: i, date: d.date, label: dayChoiceLabel(i + 1, d.date, findCity(d.city)?.name ?? d.city) })),
    [resp.days],
  );

  const groups = useMemo(() => {
    const out: { city: string; days: { index: number }[] }[] = [];
    resp.days.forEach((d, i) => {
      const last = out[out.length - 1];
      if (last && last.city === d.city) last.days.push({ index: i });
      else out.push({ city: d.city, days: [{ index: i }] });
    });
    return out;
  }, [resp.days]);

  const savedByCity = trip.saved ?? {};

  return (
    <div className={`flex flex-col gap-6 ${drag ? styles.dragActive : ""}`}>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
      {editable && (
        <p className={styles.hint}>
          Drag <span aria-hidden="true">⠿</span> to reorder or move between days. On a keyboard, focus the handle and press the up or down arrow.
        </p>
      )}
      {groups.map((g) => {
        const city = findCity(g.city);
        return (
          <section key={`${g.city}-${g.days[0].index}`} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
              <h3 className="display text-[26px]">
                {city?.name ?? g.city}
                {city?.localName && <span className="ml-2 text-[15px] text-ink-3">{city.localName}</span>}
              </h3>
              <button type="button" className="shrink-0 text-[13px] font-medium text-accent hover:underline" onClick={() => onOpenCity(g.city)}>
                Stays, sights &amp; food
              </button>
            </div>
            {g.days.map(({ index: di }) => {
              const day = resp.days[di];
              const over = drag?.over?.day === di ? drag.over.slot : null;
              const used = usedPlaceNames(resp);
              const saved = (savedByCity[day.city] ?? []).map((p) => p.name);
              return (
                <article key={day.date} className="day-card" data-day-card={di}>
                  <div className="day-date">
                    <span className="eyebrow">Day {di + 1}</span>
                    <span className="data text-[13px] text-ink-2">{fmtDay(day.date)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="display text-[20px] leading-snug">{day.title}</h4>
                    <ol
                      data-day-list={di}
                      className={`${styles.list} ${drag && over !== null ? styles.listOver : ""} ${drag ? styles.listDragging : ""}`}
                      aria-label={`Day ${di + 1} plan`}
                    >
                      {day.items.length === 0 && <li className={styles.emptyDay} aria-hidden={!editable}>Nothing planned yet.</li>}
                      {day.items.map((it, i) => {
                        const key = keyOf(it);
                        const isDragged = drag?.from.day === di && drag.from.index === i;
                        const edge = over === null ? null : over === i ? "before" : over === day.items.length && i === day.items.length - 1 ? "after" : null;
                        return (
                          <ItemRow
                            key={key}
                            rowKey={key}
                            item={it}
                            dayIndex={di}
                            index={i}
                            count={day.items.length}
                            city={day.city}
                            rating={it.placeName ? ratings[ratingKey(day.city, it.placeName)] : undefined}
                            editable={editable}
                            dragging={isDragged}
                            dropEdge={edge}
                            menuOpen={panel?.item === it && panel.kind === "menu"}
                            swapping={panel?.item === it && panel.kind === "swap"}
                            days={dayChoices}
                            onOpenPlace={onOpenPlace}
                            onHandlePointerDown={(e) => {
                              setPanel(null);
                              start(e, { day: di, index: i }, it.title);
                            }}
                            onHandleKey={onHandleKey(it)}
                            onToggleMenu={() => setPanel((p) => (p?.item === it && p.kind === "menu" ? null : { item: it, kind: "menu" }))}
                            onCloseMenu={() => setPanel(null)}
                            onMove={(dir) => moveBy(it, dir)}
                            onMoveToDay={(d) => {
                              const ref = locate(it);
                              if (!ref) return;
                              const next = moveToDay(respRef.current, ref, d);
                              setPanel(null);
                              commit(next, `Moved to ${where(next, it)}.`);
                            }}
                            onRemove={() => remove(it)}
                            onSwap={() => setPanel((p) => (p?.item === it && p.kind === "swap" ? null : { item: it, kind: "swap" }))}
                          >
                            {panel?.item === it && panel.kind === "swap" && (
                              <SwapPanel
                                day={day}
                                item={it}
                                context={{ request: plan.request, preferences: plan.preferences, used, saved }}
                                onPick={(o) => pickSwap(it, o)}
                                onClose={() => setPanel(null)}
                              />
                            )}
                          </ItemRow>
                        );
                      })}
                    </ol>

                    {undo?.date === day.date && (
                      <p className={styles.undo} role="status">
                        <span className="min-w-0">Removed &ldquo;{undo.item.title}&rdquo;.</span>
                        <button type="button" className={styles.undoBtn} onClick={undoRemove}>Undo</button>
                      </p>
                    )}

                    {editable &&
                      (adding === day.date ? (
                        <AddItemForm dayLabel={`Day ${di + 1}`} onAdd={(item) => add(di, item)} onClose={() => setAdding(null)} />
                      ) : (
                        <button type="button" className={styles.addBtn} onClick={() => { setPanel(null); setAdding(day.date); }}>
                          <PlusIcon size={14} /> Add to this day
                        </button>
                      ))}
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}
      {drag && typeof document !== "undefined" &&
        createPortal(
          <div className={styles.ghost} style={{ left: drag.x, top: drag.y }} aria-hidden="true">
            {drag.title}
          </div>,
          document.body,
        )}
    </div>
  );
}
