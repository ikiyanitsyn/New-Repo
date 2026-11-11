"use client";

import { useEffect, useRef, useState } from "react";
import { sendSignInLink, takeLinkFailed, verifyCode } from "@/lib/cloud/auth";
import s from "./Cloud.module.css";

/**
 * Email sign-in: we send one email with a 6-digit code (and a link). Typing the
 * code here signs in this app, which works inside an iPhone home-screen app too.
 */
export function SignInForm({ onDone, autoFocus = true }: { onDone?: () => void; autoFocus?: boolean }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Arrived from an email link that couldn't sign this browser in.
  const [linkFailed] = useState(() => takeLinkFailed());
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    (sentTo ? codeRef : emailRef).current?.focus();
  }, [sentTo, autoFocus]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const err = await sendSignInLink(email);
    setBusy(false);
    if (err) setError(err);
    else { setSentTo(email.trim()); setCode(""); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const err = await verifyCode(sentTo, code);
    setBusy(false);
    if (err) setError(err);
    else onDone?.();
  }

  if (sentTo) {
    return (
      <form onSubmit={verify} className="flex flex-col gap-4">
        <p className={s.lead}>
          We emailed a 6-digit code to <strong>{sentTo}</strong>. Type it here to sign in on this device.
        </p>
        <label htmlFor="signin-code" className="sr-only">Sign-in code</label>
        <input
          ref={codeRef}
          id="signin-code"
          className={`${s.input} ${s.codeInput}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={10}
          placeholder="123456"
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d ]/g, "");
            setCode(v);
          }}
        />
        {error && <p className={s.error} role="alert">{error}</p>}
        <div className={s.row}>
          <button type="submit" className="btn btn-primary !h-11 flex-1" disabled={busy || code.replace(/\D/g, "").length < 6}>
            {busy ? "Checking…" : "Sign in"}
          </button>
        </div>
        <p className={s.small}>
          No email after a minute? Check spam, or{" "}
          <button type="button" className="underline" onClick={() => send()} disabled={busy}>send a new code</button>
          {" · "}
          <button type="button" className="underline" onClick={() => { setSentTo(null); setError(null); }}>use a different email</button>.
          On a computer you can also just open the link in the email.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      {linkFailed && (
        <p className={s.error} role="alert">
          That sign-in link couldn&rsquo;t sign you in here. Links only work in the same browser or app that asked for them, and only once. Enter your email below and type the 6-digit code from the new email instead.
        </p>
      )}
      <label htmlFor="signin-email" className="sr-only">Email</label>
      <input
        ref={emailRef}
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
      <button type="submit" className="btn btn-primary !h-11" disabled={busy}>
        {busy ? "Sending…" : "Email me a sign-in code"}
      </button>
      <p className={s.small}>No password: we email you a one-time code each time you sign in on a new device.</p>
    </form>
  );
}
