"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ItemRef } from "@/lib/ai/edit";

/**
 * Drag-to-reorder with pointer events (mouse, pen and touch) and no library.
 *
 * Rows are marked `data-item-row` inside a list marked `data-day-list="<day index>"`.
 * A drag starts from a handle (which must have `touch-action: none`, so a finger on the handle
 * drags instead of scrolling the page). While dragging we hit-test the pointer against the lists,
 * work out which gap it is over, and scroll the nearest scrollable ancestor near its edges.
 * Escape or a cancelled pointer abandons the drag; nothing changes until the drop.
 */

export interface DragState {
  from: ItemRef;
  title: string;
  x: number;
  y: number;
  /** Day list and gap the pointer is over (0 = before the first row), or null when over nothing. */
  over: { day: number; slot: number } | null;
}

const EDGE = 64;
const MAX_SPEED = 18;

function scrollParent(el: Element | null): Element | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/** Which gap of which day list the point (x, y) is over. */
export function hitTest(y: number): DragState["over"] {
  const lists = Array.from(document.querySelectorAll<HTMLElement>("[data-day-list]"));
  let best: { el: HTMLElement; dist: number } | null = null;
  for (const el of lists) {
    // A little slack above and below, so the empty space around a short list still counts.
    const r = el.getBoundingClientRect();
    const dist = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    if (dist <= 36 && (!best || dist < best.dist)) best = { el, dist };
  }
  if (!best) return null;
  const rows = Array.from(best.el.querySelectorAll<HTMLElement>(":scope > [data-item-row]"));
  let slot = 0;
  for (const row of rows) {
    const r = row.getBoundingClientRect();
    if (y > r.top + r.height / 2) slot++;
  }
  return { day: Number(best.el.dataset.dayList), slot };
}

export function useDragSort(onDrop: (from: ItemRef, to: { day: number; slot: number }) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const live = useRef<DragState | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const dropRef = useRef(onDrop);
  useEffect(() => {
    dropRef.current = onDrop;
  });

  const stop = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    live.current = null;
    setDrag(null);
  }, []);

  useEffect(() => () => cleanup.current?.(), []);

  const start = useCallback(
    (e: React.PointerEvent, from: ItemRef, title: string) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      cleanup.current?.();
      const scroller = scrollParent(e.currentTarget as Element);
      const initial: DragState = { from, title, x: e.clientX, y: e.clientY, over: hitTest(e.clientY) };
      live.current = initial;
      setDrag(initial);

      let raf = 0;
      const update = (x: number, y: number) => {
        const next: DragState = { ...live.current!, x, y, over: hitTest(y) };
        live.current = next;
        setDrag(next);
      };
      const tick = () => {
        const cur = live.current;
        if (!cur) return;
        const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
        const top = Math.max(0, box.top), bottom = Math.min(window.innerHeight, box.bottom);
        let dy = 0;
        if (cur.y < top + EDGE) dy = -MAX_SPEED * Math.min(1, (top + EDGE - cur.y) / EDGE);
        else if (cur.y > bottom - EDGE) dy = MAX_SPEED * Math.min(1, (cur.y - (bottom - EDGE)) / EDGE);
        if (dy) {
          if (scroller) scroller.scrollTop += dy;
          else window.scrollBy(0, dy);
          update(cur.x, cur.y);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        update(ev.clientX, ev.clientY);
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        const over = hitTest(ev.clientY);
        const f = live.current?.from;
        stop();
        if (over && f) dropRef.current(f, over);
      };
      const abort = (ev: Event) => {
        if (ev instanceof KeyboardEvent && ev.key !== "Escape") return;
        if (ev instanceof PointerEvent && ev.pointerId !== e.pointerId) return;
        stop();
      };
      // The browser may take a touch for scrolling after all; if so, abandon rather than drop somewhere odd.
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", abort);
      window.addEventListener("keydown", abort);
      cleanup.current = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", abort);
        window.removeEventListener("keydown", abort);
      };
    },
    [stop],
  );

  return { drag, start, cancel: stop };
}
