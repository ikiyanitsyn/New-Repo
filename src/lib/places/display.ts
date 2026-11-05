import type { Place, PlaceRating } from "./types";

/** Short price for a card or map pin, e.g. "¥450" or "HK$900–1,400", when the guide's price text has one. */
export function priceShort(price: string | undefined): string | undefined {
  if (!price) return undefined;
  const m = price.match(/(?:HK\$|US\$|MOP\$?|NT\$|S\$|RMB\s?|CNY\s?|[¥$€£₩])\s?\d[\d,.]*(?:\s?[-–]\s?\d[\d,.]*)?/i);
  if (!m) return undefined;
  const out = m[0].replace(/\s?[-–]\s?/, "–").replace(/^(RMB|CNY)\s?/i, "¥").replace(/\s+/g, "");
  return out.length <= 14 ? out : undefined;
}

const TIER_SYMBOL = { Budget: "$", "Mid-range": "$$", Splurge: "$$$" } as const;
const LEVEL_SYMBOL = ["Free", "$", "$$", "$$$", "$$$$"] as const;

/** "$$", from the guide's price heading or the provider's price level. */
export function priceSymbol(p: Place, r?: PlaceRating | null): string | undefined {
  if (p.tier) return TIER_SYMBOL[p.tier];
  if (r?.priceLevel !== undefined) return LEVEL_SYMBOL[r.priceLevel];
  return undefined;
}

/** What a stay's pill on the map says: the rating when the provider allows it, else the price. */
export function stayPinLabel(p: Place, r: PlaceRating | null | undefined, ratingOnMap: boolean): string | undefined {
  if (ratingOnMap && r?.rating !== undefined) return `★ ${r.rating.toFixed(1)}`;
  return priceShort(p.price) ?? priceSymbol(p, r);
}

export const fmtCount = (n: number) => new Intl.NumberFormat("en-US").format(n);
