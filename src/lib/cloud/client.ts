"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "./url";

/**
 * The browser's connection to Supabase (accounts, saved and shared trips).
 * Both values are public by design: the publishable/anon key only allows what
 * the database's row-level security rules permit (see supabase/schema.sql).
 * Without them the app works exactly as before, saving on this device only.
 */
// Tolerates a URL copied with extra parts, e.g. ".../rest/v1/".
const URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL).url ?? undefined;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured || typeof window === "undefined") return null;
  client ??= createClient(URL!, KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}
