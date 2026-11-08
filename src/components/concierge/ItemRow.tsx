"use client";

import { useEffect, useRef } from "react";
import type { PlanItem } from "@/lib/ai/schema";
import { fmtDay } from "@/lib/format";
import { ColumnsIcon, CompassIcon, BedIcon, ForkIcon, GlassIcon, SparkIcon, TrainIcon, DownIcon, UpIcon, CloseIcon } from "../icons";
import { GripGlyph, MoreGlyph, SwapGlyph } from "./glyphs";
import { RatingBadge } from "./RatingBadge";
import type { KnownRating } from "./useKnownRatings";
import styles from "./edit.module.css";

const KIND_ICON: Record<PlanItem["kind"], (p: { size?: number; className?: string }) => React.ReactElement> = {
  see: ColumnsIcon, do: CompassIcon, eat: ForkIcon, drink: GlassIcon, stay: BedIcon, travel: TrainIcon, free: SparkIcon,
};

export interface DayChoice {
  index: number;
  date: string;
  label: string;
}

interface Props {
  rowKey: string;
  item: PlanItem;
  dayIndex: number;
  index: number;
  count: number;
  /** City the item is in, for the guide link. */
  city: string;
  rating?: KnownRating;
  editable: boolean;
  dragging: boolean;
  dropEdge: "before" | "after" | null;
  menuOpen: boolean;
  swapping: boolean;
  days: DayChoice[];
  onOpenPlace?: (city: string, placeName: string) => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onHandleKey: (e: React.KeyboardEvent) => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onMove: (dir: -1 | 1) => void;
  onMoveToDay: (day: number) => void;
  onRemove: () => void;
  onSwap: () => void;
  children?: React.ReactNode;
}

/** One line of a day: handle, icon, time, title (a link when it names a guide place), rating and actions. */
export function ItemRow(p: Props) {
  const { item, editable } = p;
  const Icon = KIND_ICON[item.kind];
  const menuBtn = useRef<HTMLButtonElement>(null);
  const tray = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Escape closes the tray and hands focus back to the button that opened it.
  useEffect(() => {
    if (p.menuOpen) {
      wasOpen.current = true;
      tray.current?.querySelector<HTMLElement>("button, select")?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      if (tray.current?.contains(document.activeElement) || document.activeElement === document.body) menuBtn.current?.focus();
    }
  }, [p.menuOpen]);

  const kindName = item.kind === "free" ? "free time" : item.kind;
  const edge = p.dropEdge === "before" ? styles.dropBefore : p.dropEdge === "after" ? styles.dropAfter : "";

  return (
    <li
      data-item-row=""
      data-row-key={p.rowKey}
      className={`${styles.row} ${p.dragging ? styles.rowDragging : ""} ${edge}`}
    >
      <div className={styles.rowMain}>
        {editable ? (
          <button
            type="button"
            className={styles.handle}
            data-handle-for={p.rowKey}
            onPointerDown={p.onHandlePointerDown}
            onKeyDown={p.onHandleKey}
            aria-label={`Reorder ${item.title}, ${item.time || "no time"}. Drag, or use the up and down arrow keys.`}
            aria-roledescription="drag handle"
          >
            <GripGlyph />
          </button>
        ) : (
          <span className={styles.handleSpacer} />
        )}
        <span className="day-icon" title={kindName}><Icon size={15} /></span>
        <span className={styles.rowBody}>
          <span className={styles.rowMeta}>
            <span className="eyebrow !text-[10px]">{item.time}</span>
            {item.mine && <span className={styles.mine}>Your note</span>}
          </span>
          <span className={styles.rowTitle}>
            {item.placeName && p.onOpenPlace ? (
              <button
                type="button"
                className="text-left text-[15px] leading-snug underline decoration-[var(--line-strong)] underline-offset-4 hover:text-accent hover:decoration-[var(--accent)]"
                onClick={() => p.onOpenPlace!(p.city, item.placeName!)}
                aria-label={`${item.title}: open ${item.placeName} in the city guide`}
              >
                {item.title}
              </button>
            ) : (
              <span className="text-[15px] leading-snug">{item.title}</span>
            )}
            <RatingBadge rating={p.rating} />
          </span>
          {item.note && <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-2">{item.note}</span>}
        </span>
        {editable && (
          <span className={styles.rowActions}>
            {item.kind !== "travel" && (
              <button type="button" className={styles.textBtn} onClick={p.onSwap} aria-expanded={p.swapping} aria-label={`Swap ${item.title}`}>
                <SwapGlyph /> Swap
              </button>
            )}
            <button
              ref={menuBtn}
              type="button"
              className={styles.iconBtn}
              onClick={p.onToggleMenu}
              aria-expanded={p.menuOpen}
              aria-label={`More actions for ${item.title}`}
            >
              <MoreGlyph />
            </button>
          </span>
        )}
      </div>

      {p.menuOpen && (
        <div
          ref={tray}
          className={styles.tray}
          role="group"
          aria-label={`Actions for ${item.title}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              p.onCloseMenu();
            }
          }}
        >
          <button type="button" className={styles.trayBtn} disabled={p.index === 0} onClick={() => p.onMove(-1)}>
            <UpIcon size={14} /> Move up
          </button>
          <button type="button" className={styles.trayBtn} disabled={p.index === p.count - 1} onClick={() => p.onMove(1)}>
            <DownIcon size={14} /> Move down
          </button>
          <label className={styles.trayBtn}>
            <span>Move to day…</span>
            <select
              className={styles.daySelect}
              value=""
              onChange={(e) => e.target.value !== "" && p.onMoveToDay(Number(e.target.value))}
              aria-label={`Move ${item.title} to day`}
            >
              <option value="" disabled>Choose a day</option>
              {p.days.filter((d) => d.index !== p.dayIndex).map((d) => (
                <option key={d.date} value={d.index}>{d.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className={`${styles.trayBtn} ${styles.danger}`} onClick={p.onRemove}>
            <CloseIcon size={14} /> Remove
          </button>
        </div>
      )}
      {p.children}
    </li>
  );
}

export const dayChoiceLabel = (n: number, date: string, city: string) => `Day ${n} · ${fmtDay(date)} · ${city}`;
