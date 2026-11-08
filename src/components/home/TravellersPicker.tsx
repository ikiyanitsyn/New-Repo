"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Cabin } from "@/lib/flights/types";
import { adultsToGuests, guestsToAdults, type Guests } from "@/lib/newTrip";
import { CloseIcon } from "../icons";
import s from "./Home.module.css";
import { Stepper } from "./Stepper";

export const CABIN_LABEL: Record<Cabin, string> = { economy: "Economy", premium: "Premium economy", business: "Business", first: "First" };
const GUEST_LABEL: Record<Guests, string> = { solo: "Solo", two: "Two", group: "Group" };

export const travellersSummary = (adults: number, cabin: Cabin) =>
  `${adults} ${adults === 1 ? "traveller" : "travellers"} · ${CABIN_LABEL[cabin]}`;

/** Travellers (solo / two / group with size) and cabin, in one popover (a sheet on phones). */
export function TravellersPicker({ adults, cabin, onChange, labelClass }: { adults: number; cabin: Cabin; onChange: (adults: number, cabin: Cabin) => void; labelClass: string }) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [groupSize, setGroupSize] = useState(Math.max(3, adults));
  const guests = adultsToGuests(adults);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLButtonElement>("button[aria-pressed='true']")?.focus();
  }, [open]);

  const close = () => { setOpen(false); trigger.current?.focus(); };

  return (
    <>
      <span className={labelClass} id={`${ids}-label`}>Travellers &amp; cabin</span>
      <button
        ref={trigger}
        type="button"
        className={s.fieldButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${ids}-label ${ids}-value`}
        onClick={() => setOpen((o) => !o)}
      >
        <span id={`${ids}-value`}>{travellersSummary(adults, cabin)}</span>
      </button>
      {open && (
        <>
          <div className={s.popScrim} onClick={close} aria-hidden />
          <div
            ref={panel}
            className={s.pop}
            role="dialog"
            aria-label="Travellers and cabin"
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}
          >
            <div className={s.popHead}>
              <span className={s.popTitle}>Travellers &amp; cabin</span>
              <button type="button" className={`btn btn-ghost btn-icon ${s.popClose}`} onClick={close} aria-label="Close">
                <CloseIcon size={16} />
              </button>
            </div>
            <div className={s.popRow}>
              <span className={s.popLabel} id={`${ids}-who`}>Who&apos;s going</span>
              <div className="segmented" role="group" aria-labelledby={`${ids}-who`}>
                {(["solo", "two", "group"] as const).map((g) => (
                  <button key={g} type="button" aria-pressed={guests === g} onClick={() => onChange(guestsToAdults(g, groupSize), cabin)}>
                    {GUEST_LABEL[g]}
                  </button>
                ))}
              </div>
              {guests === "group" && (
                <Stepper value={adults} min={3} max={9} onChange={(n) => { setGroupSize(n); onChange(n, cabin); }} unit="people" label="Group size" />
              )}
            </div>
            <div className={s.popRow}>
              <span className={s.popLabel} id={`${ids}-cabin`}>Cabin</span>
              <div className={s.cabins} role="radiogroup" aria-labelledby={`${ids}-cabin`}>
                {(Object.keys(CABIN_LABEL) as Cabin[]).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={cabin === c} className={s.cabin} onClick={() => onChange(adults, c)}>
                    {CABIN_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.popFoot}>
              <button type="button" className="btn btn-primary" onClick={close}>Done</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
