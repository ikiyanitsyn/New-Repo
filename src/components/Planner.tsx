"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import { getCity } from "@/lib/cities";
import { isTrip, sampleTrip, stopsWithDates, tripLegs, type Trip } from "@/lib/trip";
import { tripReducer } from "@/lib/tripReducer";
import type { Comfort } from "@/lib/places/types";
import { PrintButton } from "./print/PrintButton";
import { CityExplorer } from "./CityExplorer";
import { Concierge } from "./Concierge";
import { PlusIcon, SparkIcon } from "./icons";
import { Landing } from "./Landing";
import { LegPanel } from "./LegPanel";
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

  // On phones the fares panel sits below the itinerary, so bring it into view.
  const selectLeg = (id: string) => {
    setSelectedLegId(id);
    if (window.matchMedia("(max-width: 860px)").matches) {
      requestAnimationFrame(() => document.getElementById("leg-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const legs = useMemo(() => tripLegs(trip), [trip]);
  // If the selected leg disappears (stop removed or reordered), fall back to the first leg.
  const activeLegId = legs.some((l) => l.id === selectedLegId) ? selectedLegId : (legs[0]?.id ?? null);
  const selectedLeg = legs.find((l) => l.id === activeLegId);
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
  // The opening page: #start, or a first visit with nothing else asked for.
  const landingOpen = hash === "#start" || (!started && !conciergeOpen && !exploreStopId);
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

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="wordmark" aria-label="Intercontinental Nomad, home">
          Intercontinental <em>Nomad</em>
        </Link>
        <nav className="flex items-center gap-1 text-[13.5px]" aria-label="Main">
          <button type="button" className={`btn btn-ghost ${landingOpen ? "!text-ink" : ""}`} aria-current={landingOpen ? "page" : undefined} onClick={() => { window.location.hash = "start"; }}>
            <PlusIcon size={15} className="text-accent" /> <span className="sr-only sm:not-sr-only">New trip</span>
          </button>
          <button type="button" className={`btn btn-ghost hidden sm:inline-flex ${!conciergeOpen && !landingOpen ? "!text-ink" : ""}`} aria-current={!conciergeOpen && !landingOpen ? "page" : undefined} onClick={showPlanner}>Route</button>
          <button type="button" className={`btn btn-ghost ${conciergeOpen ? "!text-ink" : ""}`} aria-current={conciergeOpen ? "page" : undefined} onClick={openConcierge}>
            <SparkIcon size={15} className="text-accent" /> Concierge
          </button>
          <span className="btn btn-ghost hidden cursor-default opacity-60 sm:inline-flex" title="Coming with accounts">My trips</span>
          <span className="btn btn-ghost hidden cursor-default opacity-60 sm:inline-flex" title="Coming with accounts">Shared trips</span>
          <span className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />
          <button type="button" className="btn btn-ghost hidden !text-[12.5px] md:inline-flex" onClick={() => { dispatch({ type: "reset" }); setSelectedLegId("outbound"); }}>
            Reset to example
          </button>
          <PrintButton className="btn btn-ghost hidden md:inline-flex" label="Itinerary" />
          <ThemeToggle />
        </nav>
      </header>

      {landingOpen ? (
        <Landing trip={trip} dispatch={dispatch} hasSavedTrip={started} onPlan={showPlanner} onContinue={showPlanner} onConcierge={openConcierge} />
      ) : (
      <main className="stage">
        <Globe home={home} stops={globeStops} legs={legs} selectedLegId={activeLegId} onSelectLeg={setSelectedLegId} onOpenStop={openExplorer} />
        <div className="stage-panels">
          <TripBuilder trip={trip} dispatch={dispatch} legs={legs} selectedLegId={activeLegId} onSelectLeg={selectLeg} onExplore={openExplorer} onConcierge={openConcierge} />
          <LegPanel
            leg={selectedLeg}
            trip={trip}
            onMode={(id, mode) => dispatch({ type: "mode", key: id, mode })}
            onPick={(legId, pick) => dispatch({ type: "pick", legId, pick })}
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
        {conciergeOpen && <Concierge trip={trip} dispatch={dispatch} onClose={closeExplorer} onOpenCity={openCityFromPlan} onOpenPlace={openPlaceFromPlan} />}
      </main>
      )}
    </div>
  );
}
