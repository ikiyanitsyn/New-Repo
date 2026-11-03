const d = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00Z");

export function fmtDay(iso: string): string {
  return d(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function fmtShort(iso: string): string {
  return d(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function fmtRange(a: string, b: string): string {
  const da = d(a), db = d(b);
  const sameYear = da.getUTCFullYear() === db.getUTCFullYear();
  const left = da.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC", ...(sameYear ? {} : { year: "numeric" }) });
  const right = db.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${left} – ${right}`;
}

/** "13:05" from "YYYY-MM-DDTHH:mm" */
export function fmtTime(isoLocal: string): string {
  return isoLocal.slice(11, 16);
}

/** Whole days between two local dates (for "+1" arrival markers). */
export function dayDiff(a: string, b: string): number {
  return Math.round((d(b).getTime() - d(a).getTime()) / 86400000);
}
