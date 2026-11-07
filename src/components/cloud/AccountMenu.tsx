"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, type AuthState } from "@/lib/cloud/auth";
import type { SyncStatus, TripSync } from "@/lib/cloud/sync";
import s from "./Cloud.module.css";
import { SignInDialog } from "./SignInDialog";

const STATUS: Record<SyncStatus, { text: string; dot: string } | null> = {
  local: null,
  "signed-out": { text: "Sign in to sync", dot: s.dotWarn },
  saved: { text: "Saved", dot: s.dotSaved },
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
      {st ? (
        <span className={`${s.status} hidden lg:inline-flex`} title={sync.note ?? undefined} role="status">
          <span className={`${s.dot} ${st.dot}`} /> {st.text}
        </span>
      ) : (
        <button type="button" className="btn btn-ghost hidden !text-[12.5px] lg:inline-flex" onClick={sync.saveToAccount} title="Save this trip to your account">
          Save to my trips
        </button>
      )}
      <button type="button" className={s.avatar} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
        {(auth.email ?? "?").slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <div className={s.menuEmail}>Signed in as {auth.email}</div>
          {!sync.link && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); sync.saveToAccount(); }}>Save this trip to my trips</button>
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
