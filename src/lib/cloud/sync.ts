"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isTrip, sampleTrip, type Trip } from "../trip";
import type { TripAction } from "../tripReducer";
import type { AuthState } from "./auth";
import { supabase } from "./client";
import { createTrip, friendlyError, saveTrip, type Role, type TripSummary } from "./trips";

/**
 * Keeps the open trip in step with its copy in your account:
 *  - when you're signed in, a trip that isn't in your account yet is saved there automatically, once
 *    (never the untouched example, never twice);
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

export interface AutoSaveInput {
  signedIn: boolean;
  /** False until the traveller has left the opening page. */
  enabled: boolean;
  /** The open trip is already linked to a copy in the account. */
  linked: boolean;
  /** A create is already on its way. */
  creating: boolean;
  /** The open trip is the untouched example. */
  isExample: boolean;
  stops: number;
  /** Fingerprint of the open trip. */
  hash: string;
  /** A trip that must not be auto-saved as it stands: one just unlinked or deleted, or one whose auto-save failed. */
  blockedHash: string | null;
}

/**
 * Should the open trip be created in the account now? Only when signed in, not
 * yet linked, nothing is already being created, and the trip is a real one (not
 * the example, and with at least one city). A blocked trip waits until it changes.
 */
export function autoSaveDecision(i: AutoSaveInput): "create" | "wait" {
  if (!i.signedIn || !i.enabled || i.linked || i.creating) return "wait";
  if (i.isExample || i.stops === 0) return "wait";
  if (i.blockedHash !== null && i.blockedHash === i.hash) return "wait";
  return "create";
}

let exampleJson: string | null = null;
/** True when the trip is exactly the example a first-time visitor sees. */
export function isExampleTrip(tripJson: string): boolean {
  exampleJson ??= JSON.stringify(sampleTrip());
  return tripJson === exampleJson;
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

  // Auto-save bookkeeping. `creating` stops a second create while one is in flight;
  // `blocked` holds a trip fingerprint that must not be auto-saved; `epoch` changes when the link is dropped.
  const creating = useRef(false);
  const blocked = useRef<string | null>(null);
  const epoch = useRef(0);

  /** Create the open trip in the account once and link it. Never starts a second create. */
  const createAndLink = useCallback(async (auto: boolean) => {
    if (creating.current || latest.current.link) return;
    // Another tab may have linked this device already.
    const existing = readLink();
    if (existing) { setLinkState(existing); return; }
    const t = latest.current.trip;
    const startEpoch = epoch.current;
    creating.current = true;
    setStatus("saving");
    try {
      const { id, revision } = await createTrip(t);
      window.dispatchEvent(new Event("in:trips-changed"));
      if (epoch.current !== startEpoch) { setStatus("local"); return; } // dropped meanwhile; the new copy just sits in My trips
      setLink({ tripId: id, revision, role: "owner", syncedHash: hashOf(t) });
      setStatus("saved");
      setNote(null);
    } catch (e) {
      if (auto) blocked.current = hashOf(t);
      setStatus("error");
      setNote(friendlyError(e));
    } finally {
      creating.current = false;
    }
  }, [setLink]);

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

  // Signed in and this trip isn't in the account yet: save it automatically, once.
  const signedIn = auth.configured && !!auth.userId;
  const unlinked = !link;
  useEffect(() => {
    const decision = autoSaveDecision({
      signedIn, enabled, linked: !unlinked, creating: creating.current,
      isExample: isExampleTrip(tripJson), stops: latest.current.trip.stops.length,
      hash: fingerprint(tripJson), blockedHash: blocked.current,
    });
    if (decision !== "create") return;
    const t = setTimeout(() => { createAndLink(true); }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [signedIn, enabled, unlinked, tripJson, createAndLink]);

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
        ? (status === "saving" || status === "error" ? status : "local")
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
    // The manual fallback (and the way to save the example on purpose). Never doubles an auto-save in flight.
    saveToAccount: () => {
      blocked.current = null;
      return createAndLink(false);
    },
    openTrip: (s) => {
      if (!s.trip) return;
      adopt(s.trip, s.revision, s.role, s.id);
      setStatus(s.role === "viewer" ? "readonly" : "saved");
      setNote(null);
    },
    unlink: () => {
      // The trip open right now stays out of the account until it changes (it was just deleted, left or set aside).
      blocked.current = hashOf(latest.current.trip);
      epoch.current++;
      setLink(null);
      setStatus("local");
      setNote(null);
    },
  };
}
