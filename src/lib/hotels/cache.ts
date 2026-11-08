import type { HotelsResult } from "./types";

/**
 * The browser keeps the live prices it got for 12 hours, per city, dates and
 * guests. Reopening a city then shows the prices without spending a search.
 */

const TTL_MS = 12 * 3600_000;
const prefix = "in:hotels:v1:";

export function readHotelsCache(key: string, now: number = Date.now()): HotelsResult | null {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as HotelsResult;
    const at = Date.parse(v.fetchedAt);
    if (!Array.isArray(v.hotels) || Number.isNaN(at) || now - at > TTL_MS) return null;
    return v;
  } catch {
    return null;
  }
}

export function writeHotelsCache(key: string, value: HotelsResult): void {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the prices still show for this visit */
  }
}
