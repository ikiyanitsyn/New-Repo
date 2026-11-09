"use client";

import { useEffect, useState } from "react";
import { signOut, type AuthState } from "@/lib/cloud/auth";
import type { TripSync } from "@/lib/cloud/sync";
import { SignInDialog } from "../cloud/SignInDialog";
import { CompassIcon, MapIcon, SparkIcon } from "../icons";
import "./BottomTabs.css";
import { TAB_LABEL, TAB_ORDER, type TabId } from "./tabs";

type P = { size?: number };
const svg = (children: React.ReactNode) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
const HomeIcon = () => svg(<path d="M4 11 12 4l8 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" />);
const UserIcon = () => svg(<><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.6-3.7 3.4-5.6 7-5.6s6.4 1.9 7 5.6" /></>);

const ICON: Record<TabId, (p: P) => React.ReactElement> = {
  home: HomeIcon,
  trip: (p) => <MapIcon size={22} {...p} />,
  guide: (p) => <CompassIcon size={22} {...p} />,
  concierge: (p) => <SparkIcon size={22} {...p} />,
  account: UserIcon,
};

interface Props {
  active: TabId;
  /** The city guide the Guide tab opens: the first stop of the trip. Null when the trip has no stops. */
  guideStopId: string | null;
  auth: AuthState;
  sync: TripSync;
  onHome: () => void;
  onTrip: () => void;
  onGuide: (stopId: string) => void;
  onConcierge: () => void;
  onOpenTrips: (tab: "mine" | "shared") => void;
  onShare: () => void;
  /** Open the account page (sign-in when signed out; profile, status and stats when signed in). */
  onAccount: () => void;
}

/** The phone navigation bar. Hidden by CSS above 860px wide, where the top bar does this job. */
export function BottomTabs({ active, guideStopId, auth, sync, onHome, onTrip, onGuide, onConcierge, onOpenTrips, onShare, onAccount }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    const away = (e: Event) => { if (!(e.target as Element).closest?.("[data-btabs]")) setMenuOpen(false); };
    window.addEventListener("keydown", esc);
    document.addEventListener("pointerdown", away);
    return () => { window.removeEventListener("keydown", esc); document.removeEventListener("pointerdown", away); };
  }, [menuOpen]);

  const press = (tab: TabId) => {
    setMenuOpen(false);
    switch (tab) {
      case "home": return onHome();
      case "trip": return onTrip();
      case "concierge": return onConcierge();
      case "guide": return guideStopId ? onGuide(guideStopId) : undefined;
      case "account":
        return onAccount();
    }
  };

  const signedIn = auth.configured && !!auth.userId;
  const status = sync.link ? "Saved to My trips" : sync.status === "saving" ? "Saving…" : sync.status === "error" ? "Not saved yet" : null;

  return (
    <>
      <nav className="btabs-bar" aria-label="Sections" data-btabs>
        {TAB_ORDER.map((tab) => {
          const Icon = ICON[tab];
          return (
            <button
              key={tab}
              type="button"
              className="btabs-tab"
              aria-current={active === tab ? "page" : undefined}
              data-open={tab === "account" && menuOpen ? "true" : undefined}
              aria-haspopup={tab === "account" ? "menu" : undefined}
              aria-expanded={tab === "account" ? menuOpen : undefined}
              disabled={tab === "guide" && !guideStopId}
              onClick={() => press(tab)}
            >
              <Icon />
              <span>{TAB_LABEL[tab]}</span>
            </button>
          );
        })}
      </nav>

      {menuOpen && (
        <div className="btabs-sheet" role="menu" data-btabs>
          {signedIn ? (
            <>
              <div className="btabs-sheetHead">
                Signed in as {auth.email}
                {status && <span className="btabs-sheetStatus">{status}</span>}
              </div>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenTrips("mine"); }}>My trips</button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenTrips("shared"); }}>Shared with me</button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onShare(); }}>Share this trip</button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); signOut(); }}>Sign out</button>
            </>
          ) : (
            <div className="btabs-sheetHead" style={{ borderBottom: 0, marginBottom: 0 }}>Accounts aren&apos;t set up on this copy of the app yet, so trips stay on this device.</div>
          )}
        </div>
      )}
      {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
    </>
  );
}
