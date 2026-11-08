"use client";

import { useEffect, useState } from "react";
import { cachedTrips, friendlyError, listTrips, type TripSummary } from "@/lib/cloud/trips";
import { fmtRange } from "@/lib/format";
import { tripSummaryLine } from "@/lib/newTrip";
import type { Trip } from "@/lib/trip";
import { ArrowIcon } from "../icons";
import s from "./Home.module.css";

const RECENT_LIMIT = 4;

/**
 * "Continue: China in spring · Apr 8–24 · 5 cities", plus recent trips from
 * the account when signed in (read-only: listing uses the same cache as My trips).
 */
export function TripCards({ trip, hasSavedTrip, userId, linkedTripId, onContinue, onOpenTrip }: {
  trip: Trip;
  hasSavedTrip: boolean;
  userId: string | null;
  linkedTripId?: string;
  onContinue: () => void;
  onOpenTrip: (t: TripSummary) => void;
}) {
  const [recent, setRecent] = useState<TripSummary[]>(() => (userId ? cachedTrips() : []));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    listTrips(userId)
      .then((list) => { if (alive) { setRecent(list); setError(null); } })
      .catch((e) => { if (alive) setError(friendlyError(e)); });
    return () => { alive = false; };
  }, [userId]);

  const others = userId ? recent.filter((t) => t.id !== linkedTripId && t.trip).slice(0, RECENT_LIMIT) : [];
  if (!hasSavedTrip && others.length === 0) return null;
  const current = tripSummaryLine(trip);

  return (
    <section className={s.section} aria-labelledby="home-trips">
      <h2 id="home-trips" className={s.sectionTitle}>Your trips</h2>
      <div className={s.tripRow}>
        {hasSavedTrip && (
          <button type="button" className={`${s.tripCard} ${s.tripCurrent}`} onClick={onContinue}>
            <span className={s.tripEyebrow}>Continue</span>
            <span className={`display ${s.tripTitle}`}>{current.title}</span>
            <span className={s.tripMeta}>{current.meta}</span>
            <ArrowIcon size={15} className={s.tripArrow} />
          </button>
        )}
        {others.map((t) => (
          <button key={t.id} type="button" className={s.tripCard} onClick={() => onOpenTrip(t)}>
            <span className={s.tripEyebrow}>{t.role === "owner" ? "In your account" : "Shared with you"}</span>
            <span className={`display ${s.tripTitle}`}>{t.title}</span>
            <span className={s.tripMeta}>
              {[t.dates ? fmtRange(t.dates.start, t.dates.end) : null, t.cities.length ? `${t.cities.length} ${t.cities.length === 1 ? "city" : "cities"}` : null].filter(Boolean).join(" · ")}
            </span>
            <ArrowIcon size={15} className={s.tripArrow} />
          </button>
        ))}
      </div>
      {error && userId && <p className={s.quiet}>{error}</p>}
    </section>
  );
}
