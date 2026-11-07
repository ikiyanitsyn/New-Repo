"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isTrip, type Trip } from "../trip";
import type { TripAction } from "../tripReducer";
import type { AuthState } from "./auth";
import { supabase } from "./client";
import { createTrip, friendlyError, saveTrip, type Role, type TripSummary } from "./trips";

/**
 * Keeps the open trip in step with its copy in your account:
 *  - edits are saved a moment after you stop typing;
 *  - edits by people you share it with arrive live (Supabase Realtime);
 *  - offline edits are kept on this device and sent when you're back online.
 * Clashes are rare (edits arrive live) and resolve "last save wins", with a note.
 */

export interface CloudLink {
  tripId: string;
  revision: number;
  role: Role;
  /** Fingerprint of the trip as last saved or loaded, to tell offline edits from a stale copy. */
  syncedHash: string;
}

export type SyncStatus = "local" | "signed-out" | "saved" | "pending" | "saving" | "offline" | "readonly" | "error";

const LINK_KEY = "in:cloud-link:v1";
const SAVE_DELAY_MS = 1200;

/** Small, stable fingerprint of a string (djb2). */
export function fingerprint(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ":" + s.length;
}

/** What to do with a newer copy from the account, given whether this device has unsent edits. */
export function reconcile(localHash: string, link: CloudLink, remoteRevision: number): "adopt-remote" | "push-local" | "nothing" {
  const localChanged = localHash !== link.syncedHash;
  const remoteNewer = remoteRevision > link.revision;
  if (remoteNewer && !localChanged) return "adopt-remote";
  if (localChanged) return "push-local";
  return "nothing";
}

function readLink(): CloudLink | null {
  try {
    const v = JSON.parse(localStorage.getItem(LINK_KEY) ?? "null");
    return v && typeof v.tripId === "string" ? v : null;
  } catch {
    return null;
  }
}

function writeLink(l: CloudLink | null) {
  try {
    if (l) localStorage.setItem(LINK_KEY, JSON.stringify(l));
    else localStorage.removeItem(LINK_KEY);
  } catch {}
}

export interface TripSync {
  link: CloudLink | null;
  status: SyncStatus;
  note: string | null;
  saveToAccount: () => Promise<void>;
  openTrip: (t: TripSummary) => void;
  unlink: () => void;
}

export function useTripSync(trip: Trip, dispatch: React.Dispatch<TripAction>, auth: AuthState, enabled: boolean): TripSync {
  const [link, setLinkState] = useState<CloudLink | null>(readLink);
  const [status, setStatus] = useState<SyncStatus>("local");
  const [note, setNote] = useState<string | null>(null);
  const latest = useRef({ trip, link });
  useEffect(() => {
    latest.current = { trip, link };
  });

  const setLink = useCallback((l: CloudLink | null) => {
    writeLink(l);
    setLinkState(l);
  }, []);

  const hashOf = (t: Trip) => fingerprint(JSON.stringify(t));

  const adopt = useCallback(
    (data: Trip, revision: number, role: Role, tripId: string) => {
      setLink({ tripId, revision, role, syncedHash: hashOf(data) });
      dispatch({ type: "load", trip: data });
    },
    [dispatch, setLink],
  );

  // Save (or push offline edits), handling a clash with someone else's save.
  const push = useCallback(async () => {
    const { trip: t, link: l } = latest.current;
    if (!l || l.role === "viewer") return;
    setStatus("saving");
    try {
      let res = await saveTrip(l.tripId, t, l.revision);
      if (!res.ok && res.conflict) {
        res = await saveTrip(l.tripId, t, res.remote.revision);
        setNote("Someone else changed this trip at the same time. Your latest version was saved.");
      }
      if (res.ok) {
        // Only record the save if the link wasn't switched to another trip meanwhile.
        if (latest.current.link?.tripId === l.tripId) setLink({ ...l, revision: res.revision, syncedHash: hashOf(t) });
        setStatus("saved");
      } else {
        setStatus("error");
        setNote("This trip is no longer in your account. It's still saved on this device.");
      }
    } catch (e) {
      const msg = friendlyError(e);
      setStatus(/offline/i.test(msg) ? "offline" : "error");
      setNote(msg);
    }
  }, [setLink]);

  const active = enabled && auth.configured && !!auth.userId && !!link;

  // On sign-in or opening a linked trip: fetch the latest copy once and reconcile.
  useEffect(() => {
    if (!active || !link) return;
    const sb = supabase();
    if (!sb) return;
    let alive = true;
    sb.from("trips").select("data, revision").eq("id", link.tripId).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error) { setStatus("offline"); setNote(friendlyError(error)); return; }
      if (!data) { setStatus("error"); setNote("This trip is no longer in your account. It's still saved on this device."); return; }
      const decision = reconcile(hashOf(latest.current.trip), latest.current.link!, data.revision);
      if (decision === "adopt-remote" && isTrip(data.data)) adopt(data.data, data.revision, link.role, link.tripId);
      else if (decision === "push-local" && link.role !== "viewer") push();
      else setStatus(link.role === "viewer" ? "readonly" : "saved");
    });
    return () => { alive = false; };
    // Run once per linked trip and sign-in, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, link?.tripId, auth.userId]);

  // Save a moment after each edit.
  const tripJson = JSON.stringify(trip);
  const dirty = active && !!link && link.role !== "viewer" && fingerprint(tripJson) !== link.syncedHash;
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(push, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [tripJson, dirty, push]);

  // Live edits from others.
  useEffect(() => {
    if (!active || !link) return;
    const sb = supabase();
    if (!sb) return;
    const channel = sb
      .channel(`trip-${link.tripId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${link.tripId}` }, (payload) => {
        const row = payload.new as { data: unknown; revision: number };
        const l = latest.current.link;
        if (!l || row.revision <= l.revision || !isTrip(row.data)) return;
        if (hashOf(latest.current.trip) !== l.syncedHash) return; // unsent local edits win; they'll save next
        adopt(row.data, row.revision, l.role, l.tripId);
        setNote(null);
        setStatus(l.role === "viewer" ? "readonly" : "saved");
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
    // Re-subscribe only when the linked trip changes, not on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, link?.tripId, adopt]);

  // Back online: send what changed.
  useEffect(() => {
    if (!active) return;
    const onOnline = () => { if (status === "offline") push(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [active, status, push]);

  const shownStatus: SyncStatus = !auth.configured
    ? "local"
    : !auth.userId
      ? (link ? "signed-out" : "local")
      : !link
        ? "local"
        : link.role === "viewer"
          ? "readonly"
          : status === "saving" || status === "offline" || status === "error"
            ? status
            : dirty
              ? "pending"
              : status;

  return {
    link,
    status: shownStatus,
    note,
    saveToAccount: async () => {
      try {
        setStatus("saving");
        const { id, revision } = await createTrip(trip);
        setLink({ tripId: id, revision, role: "owner", syncedHash: hashOf(trip) });
        setStatus("saved");
        setNote(null);
        window.dispatchEvent(new Event("in:trips-changed"));
      } catch (e) {
        setStatus("error");
        setNote(friendlyError(e));
      }
    },
    openTrip: (s) => {
      if (!s.trip) return;
      adopt(s.trip, s.revision, s.role, s.id);
      setStatus(s.role === "viewer" ? "readonly" : "saved");
      setNote(null);
    },
    unlink: () => {
      setLink(null);
      setStatus("local");
      setNote(null);
    },
  };
}
