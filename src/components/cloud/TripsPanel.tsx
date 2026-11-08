"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthState } from "@/lib/cloud/auth";
import type { TripSync } from "@/lib/cloud/sync";
import { cachedTrips, deleteTrip, friendlyError, leaveTrip, listTrips, type TripSummary } from "@/lib/cloud/trips";
import { fmtRange } from "@/lib/format";
import { ArrowIcon } from "../icons";
import s from "./Cloud.module.css";
import { SignInDialog } from "./SignInDialog";

interface Props {
  tab: "mine" | "shared";
  auth: AuthState;
  sync: TripSync;
  onTab: (tab: "mine" | "shared") => void;
  onOpened: () => void;
  onClose: () => void;
  onNewTrip: () => void;
}

const ROLE_LABEL = { owner: "Yours", editor: "You can edit", viewer: "View only" } as const;

export function TripsPanel({ tab, auth, sync, onTab, onOpened, onClose, onNewTrip }: Props) {
  const [trips, setTrips] = useState<TripSummary[]>(cachedTrips);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [doneNonce, setDoneNonce] = useState(-1);
  const loading = doneNonce !== nonce;
  const load = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!auth.userId) return;
    let alive = true;
    listTrips(auth.userId)
      .then((list) => { if (alive) { setTrips(list); setError(null); } })
      .catch((e) => { if (alive) setError(friendlyError(e)); })
      .finally(() => { if (alive) setDoneNonce(nonce); });
    return () => { alive = false; };
  }, [auth.userId, nonce]);

  useEffect(() => {
    window.addEventListener("in:trips-changed", load);
    window.addEventListener("online", load);
    return () => { window.removeEventListener("in:trips-changed", load); window.removeEventListener("online", load); };
  }, [load]);

  if (!auth.userId) return <SignInDialog onClose={onClose} />;

  const shown = trips.filter((t) => (tab === "mine" ? t.role === "owner" : t.role !== "owner"));

  const remove = async (t: TripSummary) => {
    try {
      if (t.role === "owner") await deleteTrip(t.id);
      else await leaveTrip(t.id, auth.userId!);
      if (sync.link?.tripId === t.id) sync.unlink();
      setConfirm(null);
      load();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <section className={s.trips} aria-label={tab === "mine" ? "My trips" : "Shared trips"}>
      <div className={s.tripsInner}>
        <div>
          <button type="button" className="btn btn-ghost -ml-3 !px-3 !text-[13.5px]" onClick={onClose}>
            <ArrowIcon size={14} className="rotate-180" /> Back to planning
          </button>
        </div>
        <div className={s.tripsHead}>
          <div className="flex flex-col gap-2">
            <div className="eyebrow !text-accent">Your account</div>
            <h2 className={s.tripsTitle}>{tab === "mine" ? "My trips" : "Shared with me"}</h2>
          </div>
          <div className="segmented" role="tablist" aria-label="Which trips">
            <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => onTab("mine")}>My trips</button>
            <button type="button" role="tab" aria-selected={tab === "shared"} onClick={() => onTab("shared")}>Shared with me</button>
          </div>
        </div>

        {error && <p className={s.error} role="alert">{error}</p>}
        {!sync.link && tab === "mine" && sync.status !== "saving" && (
          <div className={s.empty} style={{ borderStyle: "solid", borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
            <div className="text-[15px]">
              {sync.status === "error"
                ? "The trip you're planning now didn't save to your account. It's still on this device."
                : "Trips you plan save here automatically. The one open now isn't in your account yet (the example trip isn't saved until you change it)."}
            </div>
            <button type="button" className="btn btn-primary" onClick={sync.saveToAccount}>
              {sync.status === "error" ? "Try saving again" : "Save it to my trips"}
            </button>
          </div>
        )}

        {loading && trips.length === 0 ? (
          <div className={s.grid}>{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[180px]" />)}</div>
        ) : shown.length === 0 ? (
          <div className={s.empty}>
            {tab === "mine" ? (
              <>
                <div className="display text-[22px]">No saved trips yet</div>
                <p className={s.small}>Once you start planning, your trip saves here by itself and appears on every device you sign in on.</p>
                <button type="button" className="btn" onClick={onNewTrip}>Start a new trip</button>
              </>
            ) : (
              <>
                <div className="display text-[22px]">Nothing shared with you yet</div>
                <p className={s.small}>When someone invites {auth.email} to plan a trip, it appears here after you sign in.</p>
              </>
            )}
          </div>
        ) : (
          <div className={`cascade ${s.grid}`}>
            {shown.map((t) => {
              const current = sync.link?.tripId === t.id;
              const route = t.trip ? [t.trip.home, ...t.trip.stops.map((x) => x.city)].join(" → ") : "";
              return (
                <article key={t.id} className={`lift ${s.card} ${current ? s.cardCurrent : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow">{current ? "Open now" : ROLE_LABEL[t.role]}</span>
                    {current && <span className="chip chip-accent">{ROLE_LABEL[t.role]}</span>}
                  </div>
                  <h3 className={s.cardTitle}>{t.title}</h3>
                  {route && <div className={s.route}>{route}</div>}
                  <div className={s.meta}>
                    {t.dates ? `${fmtRange(t.dates.start, t.dates.end)} · ${t.nights} nights` : "No dates yet"}
                    {t.cities.length > 0 && <> · {t.cities.join(", ")}</>}
                  </div>
                  <div className={s.small}>Updated {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                  <div className={s.cardActions}>
                    {!current && (
                      <button type="button" className="btn btn-primary !h-9" disabled={!t.trip} onClick={() => { sync.openTrip(t); onOpened(); }}>
                        Open
                      </button>
                    )}
                    {confirm === t.id ? (
                      <>
                        <button type="button" className="btn !h-9" style={{ color: "var(--bad)", borderColor: "var(--bad)" }} onClick={() => remove(t)}>
                          {t.role === "owner" ? "Delete for everyone" : "Leave trip"}
                        </button>
                        <button type="button" className="btn btn-ghost !h-9" onClick={() => setConfirm(null)}>Keep</button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-ghost !h-9" onClick={() => setConfirm(t.id)}>{t.role === "owner" ? "Delete" : "Leave"}</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!navigator.onLine && <p className={s.small}>You&apos;re offline. These are the trips from your last visit; opening one works offline too.</p>}
      </div>
    </section>
  );
}
