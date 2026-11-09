"use client";

import { useEffect } from "react";
import s from "./Cloud.module.css";
import { SignInForm } from "./SignInForm";

/** Sign in with a one-time email code: no password to remember. */
export function SignInDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={s.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="signin-title">
        <div className="eyebrow !text-accent">Your account</div>
        <h2 id="signin-title" className={s.dialogTitle}>Sign in to save your trips</h2>
        <SignInForm onDone={onClose} />
        <div><button type="button" className="btn btn-ghost" onClick={onClose}>Not now</button></div>
      </div>
    </div>
  );
}
