"use client";

import { findCity } from "../cities";
import { isTrip, tripEndDate, tripNights, type Trip } from "../trip";
import { supabase } from "./client";

/** Trips in your account (your own and the ones shared with you), as the database returns them. */
export interface TripRow {
  id: string;
  owner_id: string;
  title: string;
  data: unknown;
  revision: number;
  updated_at: string;
}

export type Role = "owner" | "editor" | "viewer";

export interface TripSummary {
  id: string;
  title: string;
  role: Role;
  revision: number;
  updatedAt: string;
  trip: Trip | null;
  cities: string[];
  dates: { start: string; end: string } | null;
  nights: number;
}

export function summarize(row: TripRow, userId: string, memberRoles: Record<string, Role>): TripSummary {
  const trip = isTrip(row.data) ? row.data : null;
  return {
    id: row.id,
    title: row.title || trip?.title || "Untitled trip",
    role: row.owner_id === userId ? "owner" : memberRoles[row.id] ?? "viewer",
    revision: row.revision,
    updatedAt: row.updated_at,
    trip,
    cities: trip ? trip.stops.map((s) => findCity(s.city)?.name ?? s.city) : [],
    dates: trip && trip.stops.length ? { start: trip.departDate, end: tripEndDate(trip) } : null,
    nights: trip ? tripNights(trip) : 0,
  };
}

const CACHE_KEY = "in:cloud-trips:v1";

/** The last list fetched, so My trips still opens offline. */
export function cachedTrips(): TripSummary[] {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function cacheTrips(list: TripSummary[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {}
}

function need() {
  const sb = supabase();
  if (!sb) throw new Error("Accounts aren't set up yet.");
  return sb;
}

/** Plain-English messages for the errors people will actually meet. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/failed to fetch|network|load failed/i.test(msg)) return "You're offline or Supabase can't be reached. Your trip is still saved on this device.";
  if (/jwt|not authenticated|auth/i.test(msg)) return "Your sign-in has expired. Sign in again.";
  if (/row-level security|permission/i.test(msg)) return "You don't have permission to change this trip.";
  if (/relation .* does not exist|schema cache/i.test(msg)) return "The database tables are missing. Run supabase/schema.sql in Supabase's SQL Editor.";
  return msg || "Something went wrong. Try again.";
}

export async function listTrips(userId: string): Promise<TripSummary[]> {
  const sb = need();
  // Pick up invitations sent since you signed in, so new shared trips appear right away.
  await sb.rpc("accept_my_invites").then(() => undefined, () => undefined);
  const [{ data: rows, error }, { data: members }] = await Promise.all([
    sb.from("trips").select("id, owner_id, title, data, revision, updated_at").order("updated_at", { ascending: false }),
    sb.from("trip_members").select("trip_id, role").eq("user_id", userId),
  ]);
  if (error) throw error;
  const roles = Object.fromEntries((members ?? []).map((m: { trip_id: string; role: Role }) => [m.trip_id, m.role]));
  const list = (rows as TripRow[]).map((r) => summarize(r, userId, roles));
  cacheTrips(list);
  return list;
}

export async function createTrip(trip: Trip): Promise<{ id: string; revision: number }> {
  const { data, error } = await need().from("trips").insert({ title: trip.title || "Untitled trip", data: trip }).select("id, revision").single();
  if (error) throw error;
  return data as { id: string; revision: number };
}

export type SaveResult = { ok: true; revision: number } | { ok: false; conflict: true; remote: TripRow } | { ok: false; conflict: false };

/**
 * Save only if nobody else saved since `revision` (the database bumps it on every save).
 * On a clash the caller gets the newer copy and decides what to do.
 */
export async function saveTrip(id: string, trip: Trip, revision: number): Promise<SaveResult> {
  const sb = need();
  const { data, error } = await sb
    .from("trips")
    .update({ title: trip.title || "Untitled trip", data: trip })
    .eq("id", id)
    .eq("revision", revision)
    .select("revision");
  if (error) throw error;
  if (data && data.length) return { ok: true, revision: (data[0] as { revision: number }).revision };
  const { data: remote } = await sb.from("trips").select("id, owner_id, title, data, revision, updated_at").eq("id", id).maybeSingle();
  return remote ? { ok: false, conflict: true, remote: remote as TripRow } : { ok: false, conflict: false };
}

export async function deleteTrip(id: string) {
  const { error } = await need().from("trips").delete().eq("id", id);
  if (error) throw error;
}

export async function leaveTrip(id: string, userId: string) {
  const { error } = await need().from("trip_members").delete().eq("trip_id", id).eq("user_id", userId);
  if (error) throw error;
}

export const shareUrl = (token: string) => `${window.location.origin}/share#${token}`;

export async function getShareLink(tripId: string): Promise<string | null> {
  const { data, error } = await need().from("share_links").select("token").eq("trip_id", tripId).eq("revoked", false).limit(1);
  if (error) throw error;
  return data && data.length ? (data[0] as { token: string }).token : null;
}

export async function createShareLink(tripId: string): Promise<string> {
  const { data, error } = await need().from("share_links").insert({ trip_id: tripId }).select("token").single();
  if (error) throw error;
  return (data as { token: string }).token;
}

export async function revokeShareLinks(tripId: string) {
  const { error } = await need().from("share_links").update({ revoked: true }).eq("trip_id", tripId);
  if (error) throw error;
}

export interface Invite { id: string; email: string; role: "editor" | "viewer"; accepted_at: string | null }

export async function listInvites(tripId: string): Promise<Invite[]> {
  const { data, error } = await need().from("trip_invites").select("id, email, role, accepted_at").eq("trip_id", tripId).order("created_at");
  if (error) throw error;
  return data as Invite[];
}

export async function invite(tripId: string, email: string, role: "editor" | "viewer") {
  const { error } = await need().from("trip_invites").upsert({ trip_id: tripId, email: email.trim().toLowerCase(), role }, { onConflict: "trip_id,email" });
  if (error) throw error;
}

/** Remove a person: their invitation and, if they joined, their access. */
export async function removePerson(tripId: string, email: string) {
  const { error } = await need().rpc("remove_trip_person", { t: tripId, person_email: email });
  if (error) throw error;
}

/** Open a view-only link (works without an account). */
export async function fetchSharedTrip(token: string): Promise<{ title: string; trip: Trip; updatedAt: string } | null> {
  const { data, error } = await need().rpc("get_shared_trip", { share_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? (data[0] as { title: string; data: unknown; updated_at: string } | undefined) : undefined;
  if (!row || !isTrip(row.data)) return null;
  return { title: row.title, trip: row.data, updatedAt: row.updated_at };
}
