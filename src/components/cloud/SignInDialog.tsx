"use client";

import { useEffect, useRef, useState } from "react";
import { sendSignInLink } from "@/lib/cloud/auth";
import s from "./Cloud.module.css";

/** Sign in with a one-time email link: no password to remember. */
export function SignInDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await sendSignInLink(email);
    setBusy(false);
    if (err) setError(err);
    else setSentTo(email.trim());
  }

  return (
    <div className={s.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="signin-title">
        <div className="eyebrow !text-accent">Your account</div>
        <h2 id="signin-title" className={s.dialogTitle}>{sentTo ? "Check your inbox" : "Sign in to save your trips"}</h2>
        {sentTo ? (
          <>
            <p className={s.lead}>
              We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this device and you&apos;ll come straight back here, signed in.
            </p>
            <p className={s.small}>Nothing arrived after a minute or two? Check spam, or try again.</p>
            <div className={s.row}>
              <button type="button" className="btn" onClick={() => setSentTo(null)}>Use a different email</button>
              <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <p className={s.lead}>
              Keep your trips on every device, share a view-only link, and plan together with people you invite. We&apos;ll email you a one-time link; there&apos;s no password.
            </p>
            <label htmlFor="signin-email" className="sr-only">Email</label>
            <input
              ref={input}
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className={s.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className={s.error} role="alert">{error}</p>}
            <div className={s.row}>
              <button type="submit" className="btn btn-primary !h-11 flex-1" disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
              <button type="button" className="btn !h-11" onClick={onClose}>Not now</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
