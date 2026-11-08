"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import { getCity } from "@/lib/cities";
import { isTrip, sampleTrip, stopsWithDates, tripLegs, type Trip } from "@/lib/trip";
import { tripReducer } from "@/lib/tripReducer";
import type { Comfort } from "@/lib/places/types";
import { PrintButton } from "./print/PrintButton";
import { useAuth } from "@/lib/cloud/auth";
import { useTripSync } from "@/lib/cloud/sync";
import { AccountMenu } from "./cloud/AccountMenu";
import { ShareDialog } from "./cloud/ShareDialog";
import { BottomTabs } from "./nav/BottomTabs";
import { activeTab } from "./nav/tabs";
import { TripsPanel } from "./cloud/TripsPanel";
import { CityExplorer } from "./CityExplorer";
import { Concierge } from "./Concierge";
import { PlusIcon, SparkIcon } from "./icons";
import { Landing } from "./Landing";
import { LegPanel } from "./LegPanel";
import { nextLegNeedingFlight } from "@/lib/flights/nextLeg";
import { usePersistedFlag } from "./planner/usePersistedFlag";
import { ThemeToggle } from "./ThemeToggle";
import { TripBuilder } from "./TripBuilder";

const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: () => <div className="globe" /> });

const STORAGE_KEY = "in:trip:v1";

function readSavedTrip(): Trip | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const t = JSON.parse(raw);
      if (isTrip(t)) return t;
    }
  } catch {}
  return null;
}

// The open city guide lives in the address (#explore-<stop>), so Back closes it and the link can be shared.
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => window.location.hash;
function safeDecode(s: string): string | undefined {
  try {
    return decodeURIComponent(s);
  } catch {
    return undefined;
  }
}
function replaceHash(hash: string) {
  history.replaceState(null, "", window.location.pathname + window.location.search + hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function Planner() {
  // Restore the trip saved on this device (Phase 4 adds accounts and cloud saves).
  const [trip, dispatch] = useReducer(tripReducer, undefined, () => readSavedTrip() ?? sampleTrip());
  const [selectedLegId, setSelectedLegId] = useState<string | null>("outbound");
  // First visit (nothing saved): show the opening page, and don't save the example until they move on.
  const [started, setStarted] = useState(() => readSavedTrip() !== null);

  useEffect(() => {
    if (!started) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
    } catch {}
  }, [trip, started]);

  // Accounts: keep the open trip in step with its copy in the cloud (when signed in and linked).
  const auth = useAuth();
  const sync = useTripSync(trip, dispatch, auth, started);

  // Planning-screen layout choices, remembered on this device.
  const [globeHidden, setGlobeHidden] = usePersistedFlag("in:planner:globe-hidden");
  const [faresCollapsed, setFaresCollapsed] = usePersistedFlag("in:planner:fares-collapsed");

  // On phones the fares panel sits below the itinerary, so bring it into view.
  const selectLeg = (id: string) => {
    setSelectedLegId(id);
    setFaresCollapsed(false); // asking for a leg's fares opens the panel again

    if (window.matchMedia("(max-width: 860px)").matches) {
      requestAnimationFrame(() => document.getElementById("leg-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const legs = useMemo(() => tripLegs(trip), [trip]);
  // If the selected leg disappears (stop removed or reordered), fall back to the first leg.
  const activeLegId = legs.some((l) => l.id === selectedLegId) ? selectedLegId : (legs[0]?.id ?? null);
  const selectedLeg = legs.find((l) => l.id === activeLegId);
  // After a fare is chosen: open the next leg that still needs a flight (outbound, between cities, return).
  const goToNextFlightLeg = (fromLegId: string) => {
    const next = nextLegNeedingFlight(legs, trip.picks, fromLegId);
    if (next) selectLeg(next);
    return next !== null;
  };
  const home = getCity(trip.home);
  const datedStops = useMemo(() => stopsWithDates(trip), [trip]);
  const globeStops = useMemo(() => datedStops.map((s, i) => ({ id: s.id, city: s.cityInfo, label: String(i + 1) })), [datedStops]);

  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  // "#explore-<stop>" opens a city guide; "#explore-<stop>~<place name>" also opens that place's page.
  const exploreTarget = hash.startsWith("#explore-") ? hash.slice("#explore-".length) : null;
  const hashStop = exploreTarget ? exploreTarget.split("~")[0] : null;
  const hashPlace = exploreTarget && exploreTarget.includes("~") ? safeDecode(exploreTarget.slice(exploreTarget.indexOf("~") + 1)) : undefined;
  const comfortPref = trip.plan?.preferences.find((p): p is Comfort => p === "Good value" || p === "Comfortable" || p === "Luxury");
  const exploreStopId = datedStops.some((s) => s.id === hashStop) ? hashStop : null;
  const conciergeOpen = hash === "#concierge";
  const tripsTab = hash === "#trips" ? "mine" : hash === "#shared" ? "shared" : null;
  const shareOpen = hash === "#share";
  // The opening page: #start, or a first visit with nothing else asked for.
  const landingOpen = hash === "#start" || (!started && !conciergeOpen && !exploreStopId && !tripsTab && !shareOpen);
  const openExplorer = (stopId: string) => { window.location.hash = `explore-${stopId}`; };
  const openConcierge = () => { setStarted(true); window.location.hash = "concierge"; };
  const showPlanner = () => { setStarted(true); setSelectedLegId("outbound"); replaceHash(""); };
  const openCityFromPlan = (cityCode: string) => {
    const stop = datedStops.find((s) => s.city === cityCode);
    if (stop) replaceHash(`#explore-${stop.id}`);
  };
  const moveExplorer = (stopId: string) => replaceHash(`#explore-${stopId}`);
  const openPlaceFromPlan = (cityCode: string, placeName: string) => {
    const stop = datedStops.find((s) => s.city === cityCode);
    if (stop) replaceHash(`#explore-${stop.id}~${encodeURIComponent(placeName)}`);
  };
  const closeExplorer = () => replaceHash("");
  // A brand-new trip (or the example) must not overwrite the trip saved in the account.
  const startFresh = () => { sync.unlink(); showPlanner(); };
  const openTrips = (tab: "mine" | "shared") => { window.location.hash = tab === "mine" ? "trips" : "shared"; };

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="wordmark" aria-label="Intercontinental Nomad, home">
          <span className="wordmark-first">Intercontinental </span><em>Nomad</em>
        </Link>
        <nav className="flex items-center gap-1 text-[13.5px]" aria-label="Main">
          {/* On phones the bottom tab bar replaces these; only the wordmark and theme toggle stay up here. */}
          <div className="contents max-[860px]:hidden">
          <button type="button" className={`btn btn-ghost ${landingOpen ? "!text-ink" : ""}`} aria-current={landingOpen ? "page" : undefined} onClick={() => { window.location.hash = "start"; }}>
            <PlusIcon size={15} className="text-accent" /> <span className="sr-only sm:not-sr-only">New trip</span>
          </button>
          <button type="button" className={`btn btn-ghost hidden sm:inline-flex ${!conciergeOpen && !landingOpen ? "!text-ink" : ""}`} aria-current={!conciergeOpen && !landingOpen ? "page" : undefined} onClick={showPlanner}>Route</button>
          <button type="button" className={`btn btn-ghost ${conciergeOpen ? "!text-ink" : ""}`} aria-current={conciergeOpen ? "page" : undefined} onClick={openConcierge}>
            <SparkIcon size={15} className="text-accent" /> Concierge
          </button>
          {auth.configured && auth.userId ? (
            <>
              <button type="button" className={`btn btn-ghost hidden lg:inline-flex ${tripsTab === "mine" ? "!text-ink" : ""}`} aria-current={tripsTab === "mine" ? "page" : undefined} onClick={() => openTrips("mine")}>My trips</button>
              <button type="button" className={`btn btn-ghost hidden lg:inline-flex ${tripsTab === "shared" ? "!text-ink" : ""}`} aria-current={tripsTab === "shared" ? "page" : undefined} onClick={() => openTrips("shared")}>Shared trips</button>
            </>
          ) : !auth.configured ? (
            <>
              <span className="btn btn-ghost hidden cursor-default opacity-60 lg:inline-flex" title="Set up Supabase to use accounts (docs/SUPABASE_SETUP.md)">My trips</span>
              <span className="btn btn-ghost hidden cursor-default opacity-60 lg:inline-flex" title="Set up Supabase to use accounts (docs/SUPABASE_SETUP.md)">Shared trips</span>
            </>
          ) : null}
          <span className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />
          <button type="button" className="btn btn-ghost hidden !text-[12.5px] xl:inline-flex" onClick={() => { sync.unlink(); dispatch({ type: "reset" }); setSelectedLegId("outbound"); }}>
            Reset to example
          </button>
          <PrintButton className="btn btn-ghost hidden md:inline-flex" label="Itinerary" />
          <AccountMenu auth={auth} sync={sync} onOpenTrips={openTrips} onShare={() => { window.location.hash = "share"; }} />
          </div>
          <ThemeToggle />
        </nav>
      </header>

      {landingOpen ? (
        <Landing trip={trip} dispatch={dispatch} hasSavedTrip={started} onPlan={startFresh} onContinue={showPlanner} onConcierge={() => { sync.unlink(); openConcierge(); }} />
      ) : (
      <main className="stage" data-globe={globeHidden ? "hidden" : "shown"} data-fares={faresCollapsed ? "collapsed" : "open"}>
        <Globe home={home} stops={globeStops} legs={legs} selectedLegId={activeLegId} onSelectLeg={setSelectedLegId} onOpenStop={openExplorer} hidden={globeHidden} />
        <div className="stage-tools">
          <button type="button" className="btn !h-8 !text-[12.5px]" onClick={() => setGlobeHidden(!globeHidden)} aria-pressed={globeHidden}>
            {globeHidden ? "Show globe" : "Hide globe"}
          </button>
        </div>
        <div className="stage-panels">
          <TripBuilder trip={trip} dispatch={dispatch} legs={legs} selectedLegId={activeLegId} onSelectLeg={selectLeg} onExplore={openExplorer} onConcierge={openConcierge} />
          <LegPanel
            leg={selectedLeg}
            trip={trip}
            onMode={(id, mode) => dispatch({ type: "mode", key: id, mode })}
            onPick={(legId, pick) => dispatch({ type: "pick", legId, pick })}
            onDate={(date) => dispatch({ type: "date", date })}
            onNextLeg={goToNextFlightLeg}
            collapsed={faresCollapsed}
            onCollapse={() => setFaresCollapsed(true)}
            onExpand={() => setFaresCollapsed(false)}
          />
        </div>
        {exploreStopId && (
          <CityExplorer
            stops={datedStops}
            stopId={exploreStopId}
            adults={trip.adults}
            saved={trip.saved?.[datedStops.find((s) => s.id === exploreStopId)!.city] ?? []}
            onToggleSave={(place) => dispatch({ type: "toggleSave", city: datedStops.find((s) => s.id === exploreStopId)!.city, place })}
            onNavigate={moveExplorer}
            onClose={closeExplorer}
            comfort={comfortPref}
            initialPlaceName={hashPlace}
          />
        )}
        {tripsTab && (
          <TripsPanel
            tab={tripsTab}
            auth={auth}
            sync={sync}
            onTab={(t) => replaceHash(t === "mine" ? "#trips" : "#shared")}
            onOpened={showPlanner}
            onClose={closeExplorer}
            onNewTrip={() => { sync.unlink(); window.location.hash = "start"; }}
          />
        )}
        {shareOpen && <ShareDialog auth={auth} sync={sync} onClose={closeExplorer} />}
        {conciergeOpen && <Concierge trip={trip} dispatch={dispatch} onClose={closeExplorer} onOpenCity={openCityFromPlan} onOpenPlace={openPlaceFromPlan} />}
      </main>
      )}
      <BottomTabs
        active={activeTab(hash, landingOpen)}
        guideStopId={exploreStopId ?? datedStops[0]?.id ?? null}
        auth={auth}
        sync={sync}
        onHome={() => { window.location.hash = "start"; }}
        onTrip={() => { setStarted(true); setSelectedLegId("outbound"); replaceHash("#trip"); }}
        onGuide={openExplorer}
        onConcierge={openConcierge}
        onOpenTrips={openTrips}
        onShare={() => { window.location.hash = "share"; }}
      />
    </div>
  );
}
