"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ITEM_KINDS, KIND_LABEL, TIME_WORDS, makeOwnItem } from "@/lib/ai/edit";
import type { PlanItem } from "@/lib/ai/schema";
import styles from "./edit.module.css";

interface Props {
  dayLabel: string;
  onAdd: (item: PlanItem) => void;
  onClose: () => void;
}

const AT_TIME = "__time";

/** "Add to this day": a time (part of the day or HH:MM), a title, a kind and an optional note. */
export function AddItemForm({ dayLabel, onAdd, onClose }: Props) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [when, setWhen] = useState<string>("Afternoon");
  const [clock, setClock] = useState("12:00");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PlanItem["kind"]>("do");
  const [note, setNote] = useState("");

  useEffect(() => titleRef.current?.focus(), []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const item = makeOwnItem({ time: when === AT_TIME ? clock : when, title, kind, note });
    if (!item) {
      titleRef.current?.focus();
      return;
    }
    onAdd(item);
  }

  return (
    <form className={styles.addForm} onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onClose()} aria-label={`Add to ${dayLabel}`}>
      <div className={styles.addGrid}>
        <label className={styles.fieldLabel} htmlFor={`${id}-when`}>When</label>
        <div className="flex gap-2">
          <select id={`${id}-when`} className="field !h-10 min-w-0 flex-1 !text-[14px]" value={when} onChange={(e) => setWhen(e.target.value)}>
            {TIME_WORDS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
            <option value={AT_TIME}>At a set time…</option>
          </select>
          {when === AT_TIME && (
            <input type="time" aria-label="Time" className="field !h-10 w-[7.5rem] !text-[14px]" value={clock} onChange={(e) => setClock(e.target.value)} required />
          )}
        </div>

        <label className={styles.fieldLabel} htmlFor={`${id}-title`}>What</label>
        <input
          id={`${id}-title`}
          ref={titleRef}
          className="field !h-10 !text-[14px]"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dumpling class, a hotel spa hour…"
          required
        />

        <label className={styles.fieldLabel} htmlFor={`${id}-kind`}>Kind</label>
        <select id={`${id}-kind`} className="field !h-10 !text-[14px]" value={kind} onChange={(e) => setKind(e.target.value as PlanItem["kind"])}>
          {ITEM_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>

        <label className={styles.fieldLabel} htmlFor={`${id}-note`}>Note</label>
        <input id={`${id}-note`} className="field !h-10 !text-[14px]" value={note} maxLength={400} onChange={(e) => setNote(e.target.value)} placeholder="Optional: booking details, a reminder" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary !h-9 !px-4 !text-[13px]">Add to {dayLabel}</button>
      </div>
    </form>
  );
}
