import type { FlightPick } from "../trip";

interface LegLike {
  id: string;
  mode: string;
  date: string;
}

/** A flight leg still needs a fare when it has no pick made for its current date. */
export function legNeedsFlight(leg: LegLike, picks: Record<string, FlightPick> | undefined): boolean {
  if (leg.mode !== "flight") return false;
  const p = picks?.[leg.id];
  return !(p && p.date === leg.date);
}

/**
 * After a fare is chosen on `currentId`, the next leg that still needs a flight.
 * Legs come in trip order (outbound, between cities, return); the search goes
 * forward from the current leg first, then wraps to any earlier leg left open.
 * The current leg counts as done, even if its pick has not reached `picks` yet.
 */
export function nextLegNeedingFlight(legs: LegLike[], picks: Record<string, FlightPick> | undefined, currentId: string): string | null {
  const at = legs.findIndex((l) => l.id === currentId);
  const order = at < 0 ? legs : [...legs.slice(at + 1), ...legs.slice(0, at)];
  return order.find((l) => l.id !== currentId && legNeedsFlight(l, picks))?.id ?? null;
}
