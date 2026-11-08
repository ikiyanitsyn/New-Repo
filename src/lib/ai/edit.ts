import { clip } from "./schema";
import type { PlanDay, PlanItem, PlanResponse } from "./schema";

/**
 * Pure helpers for editing a plan. Each returns a NEW PlanResponse (items keep their identity),
 * or the very same object when nothing changed, so callers can skip a no-op dispatch.
 */

export interface ItemRef {
  day: number;
  index: number;
}

export const TIME_WORDS = ["Morning", "Afternoon", "Evening"] as const;
export const ITEM_KINDS: PlanItem["kind"][] = ["see", "do", "eat", "drink", "stay", "travel", "free"];
export const KIND_LABEL: Record<PlanItem["kind"], string> = {
  see: "Sight", do: "Activity", eat: "Meal", drink: "Drink", stay: "Stay", travel: "Travel", free: "Free time",
};

const WORD_MINUTES: Record<string, number> = { morning: 9 * 60, afternoon: 14 * 60, evening: 19 * 60, night: 22 * 60 };

/** Minutes since midnight for "Morning" or "09:30", or null when the label isn't a time. */
export function timeKey(time: string): number | null {
  const t = time.trim().toLowerCase();
  if (t in WORD_MINUTES) return WORD_MINUTES[t];
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

const inRange = (n: number, len: number) => Number.isInteger(n) && n >= 0 && n < len;
const refOk = (resp: PlanResponse, r: ItemRef) => inRange(r.day, resp.days.length) && inRange(r.index, resp.days[r.day].items.length);

function withDays(resp: PlanResponse, change: Record<number, PlanItem[]>): PlanResponse {
  return {
    ...resp,
    days: resp.days.map((d, i): PlanDay => (i in change ? { ...d, items: change[i] } : d)),
  };
}

/**
 * Where a dragged item ends up, given the gap it was dropped into.
 * `slot` counts gaps in the destination list as drawn (0 = before the first row, n = after the last),
 * so dropping in the gap just above or below the item itself changes nothing.
 */
export function slotToIndex(from: ItemRef, toDay: number, slot: number): number {
  return toDay === from.day && slot > from.index ? slot - 1 : slot;
}

/** Move an item to `to.index` (its final position) in any day, including another day. */
export function moveItem(resp: PlanResponse, from: ItemRef, to: ItemRef): PlanResponse {
  if (!refOk(resp, from) || !inRange(to.day, resp.days.length)) return resp;
  const item = resp.days[from.day].items[from.index];
  if (from.day === to.day) {
    const items = resp.days[from.day].items.filter((_, i) => i !== from.index);
    const at = Math.max(0, Math.min(to.index, items.length));
    if (at === from.index) return resp;
    items.splice(at, 0, item);
    return withDays(resp, { [from.day]: items });
  }
  const source = resp.days[from.day].items.filter((_, i) => i !== from.index);
  const target = [...resp.days[to.day].items];
  target.splice(Math.max(0, Math.min(to.index, target.length)), 0, item);
  return withDays(resp, { [from.day]: source, [to.day]: target });
}

/** Move up (-1) or down (+1) one place within the day. */
export function stepItem(resp: PlanResponse, ref: ItemRef, dir: -1 | 1): PlanResponse {
  if (!refOk(resp, ref)) return resp;
  return moveItem(resp, ref, { day: ref.day, index: ref.index + dir });
}

/** The index at which an item with this time label keeps the day in time order (end when unsure). */
export function chronologicalIndex(items: PlanItem[], time: string): number {
  const k = timeKey(time);
  if (k === null) return items.length;
  const next = items.findIndex((it) => {
    const ik = timeKey(it.time);
    return ik !== null && ik > k;
  });
  return next < 0 ? items.length : next;
}

/** Move to another day, at the place its time suggests. */
export function moveToDay(resp: PlanResponse, ref: ItemRef, toDay: number): PlanResponse {
  if (!refOk(resp, ref) || !inRange(toDay, resp.days.length) || toDay === ref.day) return resp;
  const item = resp.days[ref.day].items[ref.index];
  return moveItem(resp, ref, { day: toDay, index: chronologicalIndex(resp.days[toDay].items, item.time) });
}

export function removeItem(resp: PlanResponse, ref: ItemRef): { response: PlanResponse; removed: PlanItem | null } {
  if (!refOk(resp, ref)) return { response: resp, removed: null };
  const removed = resp.days[ref.day].items[ref.index];
  return { response: withDays(resp, { [ref.day]: resp.days[ref.day].items.filter((_, i) => i !== ref.index) }), removed };
}

/** Put an item into a day: at `index`, or in time order when no index is given. */
export function insertItem(resp: PlanResponse, day: number, item: PlanItem, index?: number): PlanResponse {
  if (!inRange(day, resp.days.length)) return resp;
  const items = [...resp.days[day].items];
  items.splice(index === undefined ? chronologicalIndex(items, item.time) : Math.max(0, Math.min(index, items.length)), 0, item);
  return withDays(resp, { [day]: items });
}

export function replaceItem(resp: PlanResponse, ref: ItemRef, item: PlanItem): PlanResponse {
  if (!refOk(resp, ref)) return resp;
  return withDays(resp, { [ref.day]: resp.days[ref.day].items.map((it, i) => (i === ref.index ? item : it)) });
}

export interface OwnItemDraft {
  /** "Morning", "Afternoon", "Evening" or "HH:MM". */
  time: string;
  title: string;
  kind: PlanItem["kind"];
  note?: string;
}

/** A traveller's own item, trimmed to the same limits the AI's items obey. Null when there's no title. */
export function makeOwnItem(d: OwnItemDraft): PlanItem | null {
  const title = clip(d.title, 120);
  if (!title) return null;
  const time = d.time.trim();
  const note = d.note ? clip(d.note, 400) : "";
  return {
    time: timeKey(time) === null ? "" : clip(time, 20),
    title,
    kind: ITEM_KINDS.includes(d.kind) ? d.kind : "do",
    ...(note ? { note } : {}),
    mine: true,
  };
}

/** The day holding this date, so an undo still lands on the right day after other edits. */
export function dayIndexByDate(resp: PlanResponse, date: string): number {
  return resp.days.findIndex((d) => d.date === date);
}

/** Every place name already in the plan for a city, for "don't repeat" lists. */
export function usedPlaceNames(resp: PlanResponse, city?: string): string[] {
  const names = new Set<string>();
  for (const d of resp.days) {
    if (city && d.city !== city) continue;
    for (const it of d.items) if (it.placeName) names.add(it.placeName);
  }
  return [...names];
}
