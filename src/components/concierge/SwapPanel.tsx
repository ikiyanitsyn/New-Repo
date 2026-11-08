"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanDay, PlanItem, SwapOption, SwapRequest, SwapResult } from "@/lib/ai/schema";
import { RatingBadge } from "./RatingBadge";
import styles from "./edit.module.css";

interface Props {
  day: PlanDay;
  item: PlanItem;
  /** Fields of the swap request that come from the whole trip, not this item. */
  context: Pick<SwapRequest, "request" | "preferences" | "used" | "saved">;
  onPick: (option: SwapOption) => void;
  onClose: () => void;
}

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "options"; result: SwapResult };

const TIMEOUT_MS = 40_000;

/** Inline "swap this" panel: asks for alternatives and lets the traveller pick one. */
export function SwapPanel({ day, item, context, onPick, onClose }: Props) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const controller = useRef<AbortController | null>(null);
  const shown = useRef<string[]>([]);
  // Read through refs, so edits elsewhere in the day don't restart the request.
  const contextRef = useRef(context);
  const dayRef = useRef(day);
  useEffect(() => {
    contextRef.current = context;
    dayRef.current = day;
  });

  const load = useCallback(async () => {
    controller.current?.abort("replaced");
    const c = new AbortController();
    controller.current = c;
    const timer = setTimeout(() => c.abort("timeout"), TIMEOUT_MS);
    setState({ phase: "loading" });
    const ctx = contextRef.current;
    const day = dayRef.current;
    const body: SwapRequest = {
      city: day.city,
      date: day.date,
      request: ctx.request,
      preferences: ctx.preferences,
      dayTitle: day.title,
      dayItems: day.items
        .filter((it) => it !== item)
        .slice(0, 12)
        .map((it) => ({ time: it.time, title: it.title, kind: it.kind, ...(it.placeName ? { placeName: it.placeName } : {}) })),
      item: { time: item.time, title: item.title, kind: item.kind, ...(item.placeName ? { placeName: item.placeName } : {}), ...(item.note ? { note: item.note } : {}) },
      // Anything already offered is "used" too, so "Try others" gives something new.
      used: [...ctx.used, ...shown.current].slice(0, 120),
      saved: ctx.saved,
    };
    try {
      const res = await fetch("/api/plan/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: c.signal,
      });
      const j = (await res.json().catch(() => ({}))) as Partial<SwapResult> & { error?: string };
      if (!res.ok || !j.options?.length) {
        setState({ phase: "error", message: j.error || "Couldn't find alternatives. Please try again." });
        return;
      }
      shown.current.push(...j.options.flatMap((o) => (o.placeName ? [o.placeName] : [])));
      setState({ phase: "options", result: j as SwapResult });
    } catch {
      if (c.signal.reason === "timeout") setState({ phase: "error", message: "This took longer than it should. Gemini may be busy: wait a moment, then try again." });
      else if (!c.signal.aborted) setState({ phase: "error", message: "Couldn't reach the planner. Check your connection, then try again." });
    } finally {
      clearTimeout(timer);
    }
  }, [item]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the request when the panel opens
    void load();
    return () => controller.current?.abort("closed");
  }, [load]);

  return (
    <div className={styles.swap} role="group" aria-label={`Alternatives to ${item.title}`}>
      {state.phase === "loading" && (
        <p className={styles.swapStatus} role="status">
          <span className={styles.spinner} aria-hidden="true" /> Finding alternatives…
        </p>
      )}
      {state.phase === "error" && (
        <p className={styles.swapError} role="alert">{state.message}</p>
      )}
      {state.phase === "options" && (
        <>
          <ul className={styles.options}>
            {state.result.options.map((o) => (
              <li key={`${o.placeName ?? ""}|${o.title}`} className={styles.option}>
                <div className="min-w-0 flex-1">
                  <div className={styles.optionTitle}>
                    {o.title}
                    <RatingBadge rating={o.rating} />
                  </div>
                  {o.note && <p className={styles.optionNote}>{o.note}</p>}
                </div>
                <button type="button" className="btn !h-9 !px-3 !text-[13px]" onClick={() => onPick(o)} aria-label={`Use ${o.title}`}>
                  Use this
                </button>
              </li>
            ))}
          </ul>
          {state.result.notice && <p className={styles.swapNote}>{state.result.notice}</p>}
        </>
      )}
      <div className={styles.swapActions}>
        {state.phase !== "loading" && (
          <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" onClick={() => void load()}>
            {state.phase === "error" ? "Try again" : "Show others"}
          </button>
        )}
        <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" onClick={onClose}>
          {state.phase === "loading" ? "Cancel" : "Close"}
        </button>
      </div>
    </div>
  );
}
