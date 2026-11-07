"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cloudConfigured } from "@/lib/cloud/client";
import { fetchSharedTrip, friendlyError } from "@/lib/cloud/trips";
import { buildItinerary } from "@/lib/itineraryDoc";
import type { Trip } from "@/lib/trip";
import { ItineraryDocument, SECTIONS, type SectionId } from "../print/ItineraryDocument";
import { styles } from "../print/styles";
import s from "./Cloud.module.css";

const ALL = Object.fromEntries(SECTIONS.map((x) => [x.id, true])) as Record<SectionId, boolean>;
const subscribe = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };

type State = { status: "loading" } | { status: "ok"; trip: Trip; updatedAt: string } | { status: "missing" } | { status: "error"; message: string };

/** A read-only itinerary opened from a share link. */
export function ShareView() {
  const token = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "");
  const [state, setState] = useState<State>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!token || !cloudConfigured) return;
    let alive = true;
    fetchSharedTrip(token)
      .then((r) => { if (alive) setState(r ? { status: "ok", trip: r.trip, updatedAt: r.updatedAt } : { status: "missing" }); })
      .catch((e) => { if (alive) setState({ status: "error", message: friendlyError(e) }); });
    return () => { alive = false; };
  }, [token]);

  const doc = useMemo(() => (state.status === "ok" ? buildItinerary(state.trip) : null), [state]);
  useEffect(() => { if (state.status === "ok") document.title = `${state.trip.title || "Trip"} · Shared itinerary`; }, [state]);

  const message = (title: string, body: string) => (
    <div className={s.shareMessage}>
      <div className="eyebrow !text-accent">Shared itinerary</div>
      <h1 className="display text-[34px] leading-tight">{title}</h1>
      <p className="text-[15px] leading-relaxed text-ink-2">{body}</p>
      <div><Link href="/" className="btn btn-primary">Plan your own trip</Link></div>
    </div>
  );

  if (!cloudConfigured) return message("Sharing isn't switched on here", "This copy of Intercontinental Nomad isn't connected to an account service yet.");
  if (!token) return message("This link is incomplete", "Ask the person who shared it to send the whole link again.");
  if (state.status === "missing") return message("This link no longer works", "The trip's owner turned the link off or deleted the trip. Ask them for a new link.");
  if (state.status === "error") return message("Couldn't open this trip", state.message);

  const copyToMine = () => {
    if (state.status !== "ok") return;
    try {
      localStorage.setItem("in:trip:v1", JSON.stringify({ ...state.trip, title: `${state.trip.title || "Trip"} (copy)` }));
      localStorage.removeItem("in:cloud-link:v1");
      setCopied(true);
      router.push("/");
    } catch {}
  };

  return (
    <div>
      <div className={s.shareBar}>
        <Link href="/" className="wordmark">Intercontinental <em>Nomad</em></Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-3">
            View only{state.status === "ok" ? ` · updated ${new Date(state.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          </span>
          <button type="button" className="btn !h-9" disabled={state.status !== "ok"} onClick={() => window.print()}>Print or save as PDF</button>
          <button type="button" className="btn btn-primary !h-9" disabled={state.status !== "ok" || copied} onClick={copyToMine}>Make a copy to plan my own</button>
        </div>
      </div>
      <div className={styles.root}>
        {state.status === "loading" || !doc ? (
          <div className="skeleton mx-auto mt-10 h-[60vh] max-w-[816px]" />
        ) : (
          <ItineraryDocument doc={doc} sections={ALL} layout="detailed" />
        )}
      </div>
    </div>
  );
}
