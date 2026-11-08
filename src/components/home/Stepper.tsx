"use client";

import { MinusIcon, PlusIcon } from "../icons";
import s from "./Home.module.css";

export function Stepper({ value, min, max, onChange, unit, label, compact }: { value: number; min: number; max: number; onChange: (n: number) => void; unit: string; label: string; compact?: boolean }) {
  return (
    <div className={s.stepper} role="group" aria-label={label} data-compact={compact || undefined}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${unit}`}>
        <MinusIcon size={14} />
      </button>
      <span className="data" aria-live="polite">{value} <span className={s.unit}>{unit}</span></span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${unit}`}>
        <PlusIcon size={14} />
      </button>
    </div>
  );
}
