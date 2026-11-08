import { findPlaceByName } from "../places/match";
import type { Place } from "../places/types";
import type { PlanDay, PlanItem, PlanResponse } from "./schema";

/**
 * Point an item's `placeName` at a real guide listing.
 * A match gets the listing's exact name, so the guide opens the right detail page.
 * No match: the name is dropped (the title stays), because a link to nowhere is worse than none.
 */
export function linkItem(item: PlanItem, places: Place[]): PlanItem {
  if (!item.placeName) return item;
  const hit = findPlaceByName(places, item.placeName);
  if (hit) return hit.name === item.placeName ? item : { ...item, placeName: hit.name };
  const rest = { ...item };
  delete rest.placeName;
  return rest;
}

export function linkDays(days: PlanDay[], placesByCity: Record<string, Place[]>): PlanDay[] {
  return days.map((d) => {
    const places = placesByCity[d.city];
    // Without a guide for the city there is nothing to check against: leave the names alone.
    if (!places?.length) return d;
    return { ...d, items: d.items.map((it) => (it.mine ? it : linkItem(it, places))) };
  });
}

export function linkPlan(resp: PlanResponse, placesByCity: Record<string, Place[]>): PlanResponse {
  return { ...resp, days: linkDays(resp.days, placesByCity) };
}
