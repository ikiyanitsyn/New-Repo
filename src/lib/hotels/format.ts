const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "$142", "$1,153". */
export const fmtUsd = (n: number) => usd.format(Math.round(n));

/** Label on a map price pin: the nightly price, "$142". */
export const pinPriceLabel = (nightly: number | undefined) => (nightly !== undefined && nightly > 0 ? fmtUsd(nightly) : undefined);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** When a price was found, in the viewer's time: "today 3:42 PM", "yesterday", "Nov 6". */
export function fmtChecked(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay(d, now)) return `today ${time}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return `yesterday ${time}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "$142 a night" or "$142 a night, $426 for 3 nights". */
export function nightlyLine(nightly: number, nights?: number): string {
  return `${fmtUsd(nightly)} a night${nights && nights > 1 ? `, about ${fmtUsd(nightly * nights)} for ${nights} nights` : ""}`;
}
