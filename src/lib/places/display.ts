import type { Place, PlaceRating } from "./types";

/** Short price for a card or map pin, e.g. "¥450" or "HK$900–1,400", when the guide's price text has one. */
export function priceShort(price: string | undefined): string | undefined {
  if (!price) return undefined;
  const m = price.match(/(?:HK\$|US\$|MOP\$?|NT\$|S\$|RMB\s?|CNY\s?|[¥$€£₩])\s?\d[\d,.]*(?:\s?[-–]\s?\d[\d,.]*)?/i);
  if (!m) return undefined;
  // Drop punctuation the guide text runs on with, e.g. "¥588," or "¥1,200.".
  const out = m[0].replace(/[,.]+$/, "").replace(/\s?[-–]\s?/, "–").replace(/^(RMB|CNY)\s?/i, "¥").replace(/\s+/g, "");
  return out.length <= 14 ? out : undefined;
}

/** Rough exchange rates to US dollars, for an "about $135" hint next to guide prices (never for billing). */
const USD_PER: Record<string, number> = { CNY: 0.14, JPY: 0.0067, HKD: 0.128, MOP: 0.124, TWD: 0.031, SGD: 0.75, KRW: 0.00073, EUR: 1.08, GBP: 1.27 };

/** The currency of a short guide price. A bare yen sign means yuan in China and yen in Japan, so the country decides. */
function currencyOf(price: string, country?: string): string | undefined {
  if (/^US/i.test(price)) return undefined;
  if (/^HK/i.test(price)) return "HKD";
  if (/^MOP/i.test(price)) return "MOP";
  if (/^NT/i.test(price)) return "TWD";
  if (/^S\$/i.test(price)) return "SGD";
  if (price.startsWith("€")) return "EUR";
  if (price.startsWith("£")) return "GBP";
  if (price.startsWith("₩")) return "KRW";
  if (price.startsWith("¥")) return country === "JP" ? "JPY" : country === "CN" ? "CNY" : undefined;
  return undefined; // a bare dollar sign is taken as it stands
}

/** "$135" or "$6–7" for a short guide price such as "¥950" or "¥40–50"; undefined when it is already dollars or unknown. */
export function approxUsd(price: string | undefined, country?: string): string | undefined {
  if (!price) return undefined;
  const rate = USD_PER[currencyOf(price, country) ?? ""];
  if (!rate) return undefined;
  const nums = (price.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, ""))).filter((n) => n > 0);
  if (!nums.length) return undefined;
  const usd = nums.slice(0, 2).map((n) => {
    const v = n * rate;
    return v >= 100 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v));
  });
  return "$" + [...new Set(usd)].map((v) => v.toLocaleString("en-US")).join("–");
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
