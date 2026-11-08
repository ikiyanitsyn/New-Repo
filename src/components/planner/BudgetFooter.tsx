"use client";

import { useId, useState } from "react";
import { tripBudget } from "@/lib/budget";
import { formatUsd } from "@/lib/geo";
import type { Trip } from "@/lib/trip";
import { DownIcon, UpIcon } from "../icons";
import { budgetLines, isBudgetComplete, perPersonText, stillToChoose } from "./budgetFormat";

/** The whole-trip budget: total, per person, and a breakdown that opens on demand. */
export function BudgetFooter({ trip }: { trip: Trip }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const b = tripBudget(trip);
  const todo = stillToChoose(b.missing);

  return (
    <footer className="border-t border-line px-5 py-3" data-testid="budget-footer">
      <button type="button" className="flex w-full items-end justify-between gap-3 text-left" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="min-w-0">
          <span className="eyebrow !text-[10px]">{isBudgetComplete(b) ? "Trip budget" : "Trip budget so far"}</span>
          <span className="mt-0.5 block text-[12px] text-ink-2">{perPersonText(b, trip.adults)}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="data text-[22px] leading-tight">{formatUsd(b.total)}</span>
          {open ? <UpIcon size={15} className="text-ink-3" /> : <DownIcon size={15} className="text-ink-3" />}
        </span>
      </button>
      {todo && <p className="mt-1 text-[12px] text-ink-3">{todo}</p>}
      {open && (
        <dl id={id} className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line pt-2 text-[13px]">
          {budgetLines(b).map((l) => (
            <div key={l.key} className="contents">
              <dt className="text-ink-2">{l.label}</dt>
              <dd className="data text-right">{l.amount}</dd>
            </div>
          ))}
          <p className="col-span-2 mt-1 text-[11.5px] leading-snug text-ink-3">
            Ground transport is an estimate (~). Hotels are the chosen hotel&rsquo;s nightly price times nights.
          </p>
        </dl>
      )}
    </footer>
  );
}
