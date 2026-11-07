"use client";

import { useCallback, useEffect, useState } from "react";
import { isEmail, type AuthState } from "@/lib/cloud/auth";
import type { TripSync } from "@/lib/cloud/sync";
import {
  createShareLink, friendlyError, getShareLink, invite, listInvites, removePerson, revokeShareLinks, shareUrl, type Invite,
} from "@/lib/cloud/trips";
import s from "./Cloud.module.css";
import { SignInDialog } from "./SignInDialog";

/**
 * Two ways to share:
 *  - a view-only link anyone can open (email, text, anything), no account needed;
 *  - an invitation by email to plan together (both need an account), shown under Shared trips.
 */
export function ShareDialog({ auth, sync, onClose }: { auth: AuthState; sync: TripSync; onClose: () => void }) {
  const tripId = sync.link?.tripId ?? null;
  const owner = sync.link?.role === "owner";
  const [token, setToken] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!tripId || !owner) return;
    let alive = true;
    Promise.all([getShareLink(tripId), listInvites(tripId)])
      .then(([t, inv]) => { if (alive) { setToken(t); setInvites(inv); } })
      .catch((e) => { if (alive) setError(friendlyError(e)); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [tripId, owner, nonce]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!auth.userId) return <SignInDialog onClose={onClose} />;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await fn(); refresh(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };

  const link = token ? shareUrl(token) : null;
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { (document.getElementById("share-link") as HTMLInputElement | null)?.select(); }
  };

  return (
    <div className={s.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="eyebrow !text-accent">Share</div>
        <h2 id="share-title" className={s.dialogTitle}>Share this trip</h2>

        {!tripId ? (
          <>
            <p className={s.lead}>Save the trip to your account first. Then you can send a link or invite someone to plan with you.</p>
            <div className={s.row}>
              <button type="button" className="btn btn-primary" onClick={sync.saveToAccount}>Save to my trips</button>
              <button type="button" className="btn" onClick={onClose}>Close</button>
            </div>
          </>
        ) : !owner ? (
          <>
            <p className={s.lead}>Only the trip&apos;s owner can share it. Ask them for a link or an invitation for someone else.</p>
            <div><button type="button" className="btn" onClick={onClose}>Close</button></div>
          </>
        ) : (
          <>
            <section className={s.section} style={{ borderTop: 0, paddingTop: 0 }}>
              <div className={s.sectionTitle}>View-only link</div>
              <p className={s.small}>Anyone with the link can see the itinerary. They can&apos;t change anything, and they don&apos;t need an account.</p>
              {link ? (
                <>
                  <div className={s.row}>
                    <label htmlFor="share-link" className="sr-only">Share link</label>
                    <input id="share-link" readOnly value={link} className={`${s.input} ${s.copyField}`} onFocus={(e) => e.target.select()} />
                    <button type="button" className="btn btn-primary !h-11" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
                  </div>
                  <div className={s.row}>
                    <a className="btn !h-9" href={`mailto:?subject=${encodeURIComponent("Our trip itinerary")}&body=${encodeURIComponent(link)}`}>Email</a>
                    <a className="btn !h-9" href={`sms:?&body=${encodeURIComponent(link)}`}>Text message</a>
                    <button type="button" className="btn btn-ghost !h-9" disabled={busy} onClick={() => act(() => revokeShareLinks(tripId))}>Turn off link</button>
                  </div>
                </>
              ) : (
                <div><button type="button" className="btn btn-primary" disabled={busy || !loaded} onClick={() => act(() => createShareLink(tripId))}>Create a view-only link</button></div>
              )}
            </section>

            <section className={s.section}>
              <div className={s.sectionTitle}>Plan together</div>
              <p className={s.small}>Invite someone by email. Once they sign in with that email, the trip appears under Shared trips and you&apos;ll see each other&apos;s changes live.</p>
              <form
                className={s.row}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isEmail(email)) { setError("That doesn't look like an email address."); return; }
                  act(async () => { await invite(tripId, email, role); setEmail(""); });
                }}
              >
                <label htmlFor="invite-email" className="sr-only">Email to invite</label>
                <input id="invite-email" type="email" placeholder="friend@example.com" className={s.input} value={email} onChange={(e) => setEmail(e.target.value)} />
                <label htmlFor="invite-role" className="sr-only">Permission</label>
                <select id="invite-role" className="field !h-11 !w-auto" value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")}>
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button type="submit" className="btn btn-primary !h-11" disabled={busy}>Invite</button>
              </form>
              {invites.length > 0 && (
                <div className={s.inviteList}>
                  {invites.map((i) => (
                    <div key={i.id} className={s.inviteRow}>
                      <span className="min-w-0 truncate">{i.email}</span>
                      <span className="flex items-center gap-2">
                        <span className={s.small}>{i.role === "editor" ? "Can edit" : "Can view"} · {i.accepted_at ? "Joined" : "Invited"}</span>
                        <button type="button" className="btn btn-ghost !h-8 !px-2.5 !text-[12.5px]" disabled={busy} onClick={() => act(() => removePerson(tripId, i.email))} aria-label={`Remove ${i.email}`}>Remove</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {error && <p className={s.error} role="alert">{error}</p>}
            <div><button type="button" className="btn" onClick={onClose}>Done</button></div>
          </>
        )}
      </div>
    </div>
  );
}
