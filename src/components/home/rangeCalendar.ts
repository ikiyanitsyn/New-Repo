/**
 * Pure date logic for the range calendar (no React), so it is easy to test.
 * Dates are plain "YYYY-MM-DD" strings handled in UTC, like the rest of the app.
 */

export type CalendarMode = "range" | "single";

export interface DateRange {
  start?: string;
  end?: string;
}

const MS_DAY = 86400000;
const parse = (iso: string) => Date.parse(iso + "T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDaysIso = (date: string, days: number) => iso(parse(date) + days * MS_DAY);
export const nights = (start: string, end: string) => Math.round((parse(end) - parse(start)) / MS_DAY);

/** "2027-04" → { year: 2027, month: 3 } (month is 0-based). */
export const monthOf = (date: string) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 });
export const monthKey = (year: number, month: number) => {
  const d = new Date(Date.UTC(year, month, 1));
  return d.toISOString().slice(0, 7);
};
export const addMonths = (key: string, n: number) => {
  const { year, month } = monthOf(key + "-01");
  return monthKey(year, month + n);
};

/** Same day-of-month n months later, clamped to the month's end (Jan 31 + 1 → Feb 28). */
export function shiftMonths(date: string, n: number): string {
  const { year, month } = monthOf(date);
  const day = Number(date.slice(8, 10));
  const last = new Date(Date.UTC(year, month + n + 1, 0)).getUTCDate();
  return iso(Date.UTC(year, month + n, Math.min(day, last)));
}

/**
 * A month as weeks of 7 cells (Sunday first, as US calendars are), each a date
 * or null for the blanks before the 1st and after the last day.
 */
export function monthGrid(key: string): (string | null)[][] {
  const { year, month } = monthOf(key + "-01");
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= days; d++) cells.push(iso(Date.UTC(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * What a click (or Enter) on a day does.
 *  - single: the day becomes the date.
 *  - range: the first pick sets the departure; the second sets the return,
 *    unless it is on or before the departure, which starts over from that day.
 *    A pick after a complete range also starts over.
 */
export function pickDay(range: DateRange, day: string, mode: CalendarMode): DateRange {
  if (mode === "single") return { start: day };
  if (!range.start || range.end) return { start: day, end: undefined };
  if (parse(day) <= parse(range.start)) return { start: day, end: undefined };
  return { start: range.start, end: day };
}

/** Why a range can't be used yet, or null when it can. */
export function rangeProblem(range: DateRange, mode: CalendarMode, min?: string): string | null {
  if (!range.start) return "Choose a departure date.";
  if (min && parse(range.start) < parse(min)) return "The departure date is in the past.";
  if (mode === "single") return null;
  if (!range.end) return "Choose a return date.";
  if (parse(range.end) <= parse(range.start)) return "Return must be after departure.";
  if (nights(range.start, range.end) > 60) return "Keep trips to 60 nights or fewer.";
  return null;
}

export type DayState = "start" | "end" | "inside" | "single" | "none";

/** How a day is drawn; `hover` previews the range while choosing the return. */
export function dayState(day: string, range: DateRange, mode: CalendarMode, hover?: string): DayState {
  const { start } = range;
  if (!start) return "none";
  if (mode === "single") return day === start ? "single" : "none";
  const end = range.end ?? (hover && parse(hover) > parse(start) ? hover : undefined);
  if (day === start) return end ? "start" : "single";
  if (!end) return "none";
  if (day === end) return "end";
  return parse(day) > parse(start) && parse(day) < parse(end) ? "inside" : "none";
}

/** Keyboard movement in the grid, following the WAI-ARIA date picker pattern. */
export function moveFocus(day: string, key: string, shift = false): string | null {
  const dow = new Date(parse(day)).getUTCDay();
  switch (key) {
    case "ArrowLeft": return addDaysIso(day, -1);
    case "ArrowRight": return addDaysIso(day, 1);
    case "ArrowUp": return addDaysIso(day, -7);
    case "ArrowDown": return addDaysIso(day, 7);
    case "Home": return addDaysIso(day, -dow);
    case "End": return addDaysIso(day, 6 - dow);
    case "PageUp": return shiftMonths(day, shift ? -12 : -1);
    case "PageDown": return shiftMonths(day, shift ? 12 : 1);
    default: return null;
  }
}

export const isBefore = (a: string, b: string) => parse(a) < parse(b);
