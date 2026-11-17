"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
export function TravellersPicker({ adults, cabin, onChange, labelClass, noCabin = false }: {
  adults: number; cabin: Cabin; onChange: (adults: number, cabin: Cabin) => void; labelClass: string;
  /** A stay with no flights: just guests, no cabin. */
  noCabin?: boolean;
}) {
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
  // On phones the picker is a bottom sheet: render it at the page root so the tab bar can't cover it.
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <>
      <span className={labelClass} id={`${ids}-label`}>{noCabin ? "Guests" : <>Travellers &amp; cabin</>}</span>
      <button
        ref={trigger}
        type="button"
        className={s.fieldButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${ids}-label ${ids}-value`}
        onClick={() => setOpen((o) => !o)}
      >
        <span id={`${ids}-value`}>{noCabin ? `${adults} ${adults === 1 ? "guest" : "guests"}` : travellersSummary(adults, cabin)}</span>
      </button>
      {open && sheet(phone, (
        <>
          <div className={s.popScrim} onClick={close} aria-hidden />
          <div
            ref={panel}
            className={s.pop}
            role="dialog"
            aria-label={noCabin ? "Guests" : "Travellers and cabin"}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}
          >
            <div className={s.popHead}>
              <span className={s.popTitle}>{noCabin ? "Guests" : <>Travellers &amp; cabin</>}</span>
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
            {!noCabin && <div className={s.popRow}>
              <span className={s.popLabel} id={`${ids}-cabin`}>Cabin</span>
              <div className={s.cabins} role="radiogroup" aria-labelledby={`${ids}-cabin`}>
                {(Object.keys(CABIN_LABEL) as Cabin[]).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={cabin === c} className={s.cabin} onClick={() => onChange(adults, c)}>
                    {CABIN_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>}
            <div className={s.popFoot}>
              <button type="button" className="btn btn-primary" onClick={close}>Done</button>
            </div>
          </div>
        </>
      ))}
    </>
  );
}

const sheet = (phone: boolean, node: ReactNode) => (phone ? createPortal(node, document.body) : node);
