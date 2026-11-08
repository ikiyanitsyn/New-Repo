import type { Budget } from "@/lib/budget";
import { formatUsd } from "@/lib/geo";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Still to choose: 2 flights, 3 hotels", or null when nothing is left. */
export function stillToChoose(missing: Budget["missing"]): string | null {
  const parts: string[] = [];
  if (missing.flights > 0) parts.push(plural(missing.flights, "flight"));
  if (missing.hotels > 0) parts.push(plural(missing.hotels, "hotel"));
  if (missing.hotelPrices > 0) parts.push(plural(missing.hotelPrices, "hotel price"));
  return parts.length ? `Still to choose: ${parts.join(", ")}` : null;
}

export const isBudgetComplete = (b: Budget) => stillToChoose(b.missing) === null;

/** An amount for the breakdown: a dash when nothing is counted yet, "~" for estimates. */
export function fmtAmount(n: number, approx = false): string {
  return n === 0 ? "\u2014" : `${approx ? "~" : ""}${formatUsd(n)}`;
}

export interface BudgetLine {
  key: "flights" | "ground" | "hotels" | "activities";
  label: string;
  amount: string;
}

export function budgetLines(b: Budget): BudgetLine[] {
  return [
    { key: "flights", label: "Flights", amount: fmtAmount(b.flights) },
    { key: "ground", label: "Ground transport", amount: fmtAmount(b.ground, true) },
    { key: "hotels", label: "Hotels", amount: fmtAmount(b.hotels) },
    { key: "activities", label: "Activities", amount: fmtAmount(b.activities) },
  ];
}

/** "$1,200 per person" for groups; "1 traveller" when solo (the total is the per-person figure). */
export function perPersonText(b: Budget, adults: number): string {
  return adults > 1 ? `${formatUsd(b.perPerson)} per person \u00b7 ${adults} travellers` : "1 traveller";
}
