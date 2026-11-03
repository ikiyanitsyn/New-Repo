"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useReducer, useState } from "react";
import { getCity } from "@/lib/cities";
import { isTrip, sampleTrip, stopsWithDates, tripLegs, type Trip } from "@/lib/trip";
import { tripReducer } from "@/lib/tripReducer";
import { LegPanel } from "./LegPanel";
import { ThemeToggle } from "./ThemeToggle";
import { TripBuilder } from "./TripBuilder";

const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: () => <div className="globe" /> });

const STORAGE_KEY = "in:trip:v1";

function loadSavedTrip(): Trip {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const t = JSON.parse(raw);
      if (isTrip(t)) return t;
    }
  } catch {}
  return sampleTrip();
}

export function Planner() {
  // Restore the trip saved on this device (Phase 4 adds accounts and cloud saves).
  const [trip, dispatch] = useReducer(tripReducer, undefined, loadSavedTrip);
  const [selectedLegId, setSelectedLegId] = useState<string | null>("outbound");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
    } catch {}
  }, [trip]);

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
  const globeStops = useMemo(
    () => stopsWithDates(trip).map((s, i) => ({ city: s.cityInfo, label: String(i + 1) })),
    [trip],
  );

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="wordmark" aria-label="Intercontinental Nomad, home">
          Intercontinental <em>Nomad</em>
        </Link>
        <nav className="flex items-center gap-1 text-[13.5px]" aria-label="Main">
          <span className="btn btn-ghost !text-ink" aria-current="page">Plan</span>
          <span className="btn btn-ghost hidden cursor-default opacity-60 sm:inline-flex" title="Coming with accounts">My trips</span>
          <span className="btn btn-ghost hidden cursor-default opacity-60 sm:inline-flex" title="Coming with accounts">Shared trips</span>
          <span className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />
          <button type="button" className="btn btn-ghost hidden !text-[12.5px] md:inline-flex" onClick={() => { dispatch({ type: "reset" }); setSelectedLegId("outbound"); }}>
            Reset to example
          </button>
          <ThemeToggle />
        </nav>
      </header>

      <main className="stage">
        <Globe home={home} stops={globeStops} legs={legs} selectedLegId={activeLegId} onSelectLeg={setSelectedLegId} />
        <div className="stage-panels">
          <TripBuilder trip={trip} dispatch={dispatch} legs={legs} selectedLegId={activeLegId} onSelectLeg={selectLeg} />
          <LegPanel
            leg={selectedLeg}
            trip={trip}
            onMode={(id, mode) => dispatch({ type: "mode", key: id, mode })}
            onPick={(legId, pick) => dispatch({ type: "pick", legId, pick })}
          />
        </div>
      </main>
    </div>
  );
}
