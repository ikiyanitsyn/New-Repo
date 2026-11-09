"use client";

import { useEffect, useMemo, useState } from "react";
import { findCity } from "@/lib/cities";
import { signOut, updateName, type AuthState } from "@/lib/cloud/auth";
import type { TripSync } from "@/lib/cloud/sync";
import { cachedTrips, listTrips, type TripSummary } from "@/lib/cloud/trips";
import { fmtRange } from "@/lib/format";
import { ArrowIcon } from "../icons";
import s from "./Cloud.module.css";
import { SignInForm } from "./SignInForm";

interface Props {
  auth: AuthState;
  sync: TripSync;
  onClose: () => void;
  onOpenTrips: (tab: "mine" | "shared") => void;
  onShare: () => void;
}

const SYNC_TEXT: Record<string, string> = {
  saved: "Your current trip is saved to My trips and syncs automatically.",
  pending: "Saving your latest changes…",
  saving: "Saving your latest changes…",
  offline: "You're offline. Changes are kept on this device and sent when you're back online.",
  readonly: "You're viewing a trip someone shared with you (view only).",
  error: "Your current trip isn't saved yet. Open the account menu to try again.",
  local: "Your current trip will save to My trips as soon as you change something.",
  "signed-out": "Sign in to sync.",
};

/** Travel stats across every trip in the account. */
export function tripStats(trips: TripSummary[]) {
  const mine = trips.filter((t) => t.role === "owner");
  const cities = new Set<string>();
  const countries = new Set<string>();
  let nights = 0, saved = 0;
  for (const t of trips) {
    nights += t.nights;
    for (const st of t.trip?.stops ?? []) {
      cities.add(st.city);
      const c = findCity(st.city);
      if (c) countries.add(c.country);
    }
    saved += Object.values(t.trip?.saved ?? {}).reduce((n, list) => n + list.length, 0);
  }
  const today = new Date().toISOString().slice(0, 10);
  const next = [...trips].filter((t) => t.dates && t.dates.start >= today).sort((a, b) => a.dates!.start.localeCompare(b.dates!.start))[0];
  return { trips: mine.length, shared: trips.length - mine.length, cities: cities.size, countries: countries.size, nights, saved, next };
}

export function AccountPanel({ auth, sync, onClose, onOpenTrips, onShare }: Props) {
  const [trips, setTrips] = useState<TripSummary[]>(cachedTrips);
  const [name, setName] = useState(auth.name ?? "");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.userId) return;
    let alive = true;
    listTrips(auth.userId).then((t) => { if (alive) setTrips(t); }).catch(() => {});
    return () => { alive = false; };
  }, [auth.userId, sync.link?.tripId]);

  const stats = useMemo(() => tripStats(trips), [trips]);
  const display = auth.name || auth.email?.split("@")[0] || "Traveller";

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = await updateName(name);
    setMsg(err ?? "Saved");
    if (!err) setEditing(false);
    setTimeout(() => setMsg(null), 2500);
  };

  return (
    <section className={s.trips} aria-label="Your account">
      <div className={s.tripsInner}>
        <div>
          <button type="button" className="btn btn-ghost -ml-3 !px-3 !text-[13.5px]" onClick={onClose}>
            <ArrowIcon size={14} className="rotate-180" /> Back
          </button>
        </div>

        {!auth.configured ? (
          <div className={s.empty}>
            <h2 className={s.tripsTitle}>Your account</h2>
            <p className={s.lead}>Accounts aren&apos;t set up on this copy of the app yet, so trips stay on this device.</p>
          </div>
        ) : !auth.userId ? (
          <div className="flex max-w-[480px] flex-col gap-4">
            <div className="eyebrow !text-accent">Your account</div>
            <h2 className={s.tripsTitle}>Sign in</h2>
            <p className={s.lead}>Keep your trips on every device, share them, and plan together. We&apos;ll email you a 6-digit code.</p>
            <SignInForm autoFocus={false} />
          </div>
        ) : (
          <>
            <div className={s.profile}>
              <div className={s.avatarLg} aria-hidden>{display.slice(0, 1).toUpperCase()}</div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="eyebrow !text-accent">Signed in</div>
                {editing ? (
                  <form onSubmit={saveName} className={s.row}>
                    <label htmlFor="acct-name" className="sr-only">Your name</label>
                    <input id="acct-name" className={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
                    <button type="submit" className="btn btn-primary !h-11">Save</button>
                    <button type="button" className="btn btn-ghost !h-11" onClick={() => setEditing(false)}>Cancel</button>
                  </form>
                ) : (
                  <h2 className={s.tripsTitle} style={{ overflowWrap: "anywhere" }}>
                    {display}{" "}
                    <button type="button" className="btn btn-ghost !h-8 !px-2.5 !text-[12.5px] align-middle" onClick={() => { setName(auth.name ?? ""); setEditing(true); }}>
                      {auth.name ? "Edit name" : "Add your name"}
                    </button>
                  </h2>
                )}
                <p className="text-[14px] text-ink-2" style={{ overflowWrap: "anywhere" }}>{auth.email}</p>
                {msg && <p className={s.small}>{msg}</p>}
              </div>
            </div>

            <p className="text-[14.5px] text-ink-2">{SYNC_TEXT[sync.status] ?? ""}</p>

            <div className={`cascade ${s.statGrid}`}>
              <div className={s.stat}><span className={s.statNum}>{stats.trips}</span><span className={s.statLabel}>{stats.trips === 1 ? "trip" : "trips"} planned</span></div>
              <div className={s.stat}><span className={s.statNum}>{stats.cities}</span><span className={s.statLabel}>cities</span></div>
              <div className={s.stat}><span className={s.statNum}>{stats.countries}</span><span className={s.statLabel}>{stats.countries === 1 ? "country" : "countries"}</span></div>
              <div className={s.stat}><span className={s.statNum}>{stats.nights}</span><span className={s.statLabel}>nights away</span></div>
              <div className={s.stat}><span className={s.statNum}>{stats.saved}</span><span className={s.statLabel}>places saved</span></div>
              <div className={s.stat}><span className={s.statNum}>{stats.shared}</span><span className={s.statLabel}>shared with you</span></div>
            </div>

            {stats.next && (
              <article className={`lift ${s.card}`}>
                <span className="eyebrow">Next trip</span>
                <h3 className={s.cardTitle}>{stats.next.title}</h3>
                <div className={s.meta}>{fmtRange(stats.next.dates!.start, stats.next.dates!.end)} · {stats.next.cities.join(", ")}</div>
              </article>
            )}

            <div className={s.links}>
              <button type="button" className="btn btn-primary" onClick={() => onOpenTrips("mine")}>My trips</button>
              <button type="button" className="btn" onClick={() => onOpenTrips("shared")}>Shared with me</button>
              <button type="button" className="btn" onClick={onShare}>Share this trip</button>
              <button type="button" className="btn btn-ghost" onClick={() => { signOut(); onClose(); }}>Sign out</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
