"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { cloudConfigured, supabase } from "./client";

export interface AuthState {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  email: string | null;
  userId: string | null;
  /** The name the traveller chose for their account, if any. */
  name: string | null;
}

/** Signed-in state, kept in step with Supabase (including the return from an email sign-in link). */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!cloudConfigured);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setReady(true);
      if (event === "SIGNED_IN") {
        // Turn any invitations sent to this email into shared trips.
        sb.rpc("accept_my_invites").then(() => window.dispatchEvent(new Event("in:trips-changed")));
        // Tidy the one-time sign-in code out of the address bar.
        const url = new URL(window.location.href);
        if (url.searchParams.has("code")) {
          url.searchParams.delete("code");
          history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    configured: cloudConfigured,
    ready,
    session,
    email: session?.user.email ?? null,
    userId: session?.user.id ?? null,
    name: (session?.user.user_metadata?.name as string | undefined)?.trim() || null,
  };
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** Email a one-time sign-in link. Returns an error message in plain English, or null. */
export async function sendSignInLink(email: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Accounts aren't set up yet (see docs/SUPABASE_SETUP.md).";
  if (!isEmail(email)) return "That doesn't look like an email address.";
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/`, shouldCreateUser: true },
  });
  if (!error) return null;
  if (/rate|too many/i.test(error.message)) return "Too many sign-in emails for now. Wait a few minutes and try again.";
  if (/redirect/i.test(error.message)) return "This address isn't in Supabase's allowed redirect URLs yet (Authentication → URL Configuration).";
  return error.message;
}

export async function signOut() {
  await supabase()?.auth.signOut();
}

/**
 * Finish signing in with the code from the email. This keeps sign-in inside the
 * app you started from (an iPhone home-screen app and Safari don't share sign-ins,
 * so a link opened in Safari can't sign the app in).
 */
export async function verifyCode(email: string, code: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Accounts aren't set up yet.";
  const token = code.replace(/\D/g, "");
  if (token.length < 6) return "Enter the code from the email (6 digits).";
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token, type: "email" });
  if (!error) return null;
  if (/expired|invalid/i.test(error.message)) return "That code didn't work or has expired. Check the newest email, or send a new code.";
  if (/rate|too many/i.test(error.message)) return "Too many tries. Wait a minute and try again.";
  return error.message;
}

/** Save the name shown on your account. */
export async function updateName(name: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Accounts aren't set up yet.";
  const { error } = await sb.auth.updateUser({ data: { name: name.trim().slice(0, 60) } });
  return error ? error.message : null;
}
