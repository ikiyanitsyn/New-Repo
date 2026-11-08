import type { Cabin } from "./types";

/**
 * What a fare includes for bags, per traveller. A missing field means the
 * provider did not say; the UI then shows "check with airline" and never guesses.
 */
export interface BagInfo {
  carryOn?: number;
  checked?: number;
}

const NOT_INCLUDED = /not included|not allowed|unavailable|no (free )?(carry|checked)|for a fee|extra charge|additional charge/i;

function count(s: string, word: string): number | undefined {
  const m = s.match(new RegExp(`(\\d+)(?:st|nd|rd|th)?\\s*(?:free\\s*)?${word}`, "i"));
  return m ? Number(m[1]) : undefined;
}

/**
 * Reads bag allowances out of SerpApi-style `extensions` strings, e.g.
 * "Carry-on bag not included", "Checked baggage for a fee", "1st checked bag free",
 * "2 checked bags included". Only phrases that clearly say included or not are used.
 */
export function parseBags(extensions: string[] | undefined): BagInfo {
  const info: BagInfo = {};
  for (const raw of extensions ?? []) {
    const s = raw.trim();
    if (/carry-?\s?on/i.test(s)) {
      if (NOT_INCLUDED.test(s)) info.carryOn = 0;
      else if (/included|free/i.test(s)) info.carryOn = count(s, "carry-?\\s?on") ?? 1;
    } else if (/checked|baggage|\bbags?\b/i.test(s)) {
      if (NOT_INCLUDED.test(s)) info.checked = info.checked ?? 0;
      else if (/included|free/i.test(s)) info.checked = count(s, "checked") ?? count(s, "bags?") ?? 1;
    }
  }
  return info;
}

export const bagsKnown = (b: BagInfo | undefined) => b !== undefined && (b.carryOn !== undefined || b.checked !== undefined);

export type FareType = "Basic economy" | "Main cabin" | "Premium economy" | "Business" | "First";

/**
 * Fare type from the cabin searched, shown as "Basic economy" only when the
 * provider says so in words (Google Flights uses it in travel class / extensions).
 */
export function fareTypeOf(cabin: Cabin, providerText: string[] | undefined): FareType {
  if (cabin === "economy" && (providerText ?? []).some((s) => /basic/i.test(s))) return "Basic economy";
  return ({ economy: "Main cabin", premium: "Premium economy", business: "Business", first: "First" } as const)[cabin];
}
