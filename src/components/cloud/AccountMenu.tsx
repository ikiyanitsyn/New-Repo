"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, type AuthState } from "@/lib/cloud/auth";
import type { SyncStatus, TripSync } from "@/lib/cloud/sync";
import s from "./Cloud.module.css";
import { SignInDialog } from "./SignInDialog";

const STATUS: Record<SyncStatus, { text: string; dot: string } | null> = {
  local: null,
  "signed-out": { text: "Sign in to sync", dot: s.dotWarn },
  saved: { text: "Saved to My trips", dot: s.dotSaved },
  pending: { text: "Saving…", dot: s.dotBusy },
  saving: { text: "Saving…", dot: s.dotBusy },
  offline: { text: "Offline · kept on this device", dot: s.dotWarn },
  readonly: { text: "View only", dot: s.dot },
  error: { text: "Not saved", dot: s.dotWarn },
};

interface Props {
  auth: AuthState;
  sync: TripSync;
  onOpenTrips: (tab: "mine" | "shared") => void;
  onShare: () => void;
}

export function AccountMenu({ auth, sync, onOpenTrips, onShare }: Props) {
  const [open, setOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);

  if (!auth.configured || !auth.ready) return null;

  if (!auth.userId) {
    return (
      <>
        <button type="button" className="btn btn-ghost" onClick={() => setSigningIn(true)}>Sign in</button>
        {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
      </>
    );
  }

  const st = STATUS[sync.status];
  return (
    <div ref={box} className="relative flex items-center gap-2">
      {st && !sync.link && sync.status === "error" ? (
        // Auto-save didn't work: the pill itself is the manual fallback.
        <button type="button" className={`${s.status} hidden cursor-pointer lg:inline-flex`} title={sync.note ?? "Try saving this trip again"} onClick={sync.saveToAccount}>
          <span className={`${s.dot} ${st.dot}`} /> Not saved · Try again
        </button>
      ) : st ? (
        <span className={`${s.status} hidden lg:inline-flex`} title={sync.note ?? undefined} role="status">
          <span className={`${s.dot} ${st.dot}`} /> {st.text}
        </span>
      ) : null}
      {/* Trips save to the account automatically; this is the fallback for the example trip, which waits until you change something. */}
      {!sync.link && !st && (
        <button type="button" className="btn btn-ghost hidden !text-[12.5px] lg:inline-flex" onClick={sync.saveToAccount} title="Trips save to your account automatically once you change something. Use this to save the example trip as it is.">
          Save to my trips
        </button>
      )}
      <button type="button" className={s.avatar} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
        {(auth.email ?? "?").slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <div className={s.menuEmail}>Signed in as {auth.email}</div>
          {sync.link ? (
            <div className={s.menuEmail}>{STATUS[sync.status]?.text ?? "Saved to My trips"} · your changes save automatically</div>
          ) : (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); sync.saveToAccount(); }}>
              {sync.status === "error" ? "Try saving this trip again" : "Save this trip to my trips"}
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenTrips("mine"); }}>My trips</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenTrips("shared"); }}>Shared with me</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onShare(); }}>Share this trip</button>
          {sync.note && <div className={s.menuEmail} style={{ borderBottom: 0, borderTop: "1px solid var(--line)", marginTop: 4 }}>{sync.note}</div>}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
