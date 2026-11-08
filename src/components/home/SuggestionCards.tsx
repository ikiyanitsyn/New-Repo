"use client";

import { useState } from "react";
import type { TripSearch } from "@/lib/newTrip";
import { CloseIcon, SparkIcon } from "../icons";
import s from "./Home.module.css";
import { suggestionsFor, type SuggestionAction } from "./suggestions";

const KEY = "in:home-dismissed:v1";

function readDismissed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Quiet suggestion cards under the search (never over it): at most two,
 * each dismissible, remembered on this device. Rules live in suggestions.ts.
 */
export function SuggestionCards({ search, onAction }: { search: TripSearch; onAction: (a: SuggestionAction) => void }) {
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const cards = suggestionsFor(search, dismissed);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  };

  return (
    <div className={s.suggestions} aria-live="polite">
      {cards.map((c) => (
        <div key={c.id} className={s.suggestion}>
          <SparkIcon size={13} className={s.suggestionSpark} />
          <p className={s.suggestionText}>{c.text}</p>
          {c.action && (
            <button type="button" className={s.suggestionAction} onClick={() => { onAction(c.action!); if (c.action!.kind !== "link") dismiss(c.id); }}>
              {c.action.label}
            </button>
          )}
          <button type="button" className={s.suggestionClose} onClick={() => dismiss(c.id)} aria-label="Dismiss suggestion">
            <CloseIcon size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
