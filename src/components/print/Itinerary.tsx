"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildItinerary, csvFileName, itineraryCsv } from "@/lib/itineraryDoc";
import { isTrip, sampleTrip, type Trip } from "@/lib/trip";
import { tripReducer, type TripAction } from "@/lib/tripReducer";
import { ItineraryDocument, SECTIONS, type EditApi, type Layout, type SectionId } from "./ItineraryDocument";
import { styles } from "./styles";

/** Same key the planner saves to (see Planner.tsx). */
const TRIP_KEY = "in:trip:v1";
const PREFS_KEY = "in:itinerary:v1";

interface Prefs {
  sections: Record<SectionId, boolean>;
  layout: Layout;
}

const DEFAULT_PREFS: Prefs = {
  sections: Object.fromEntries(SECTIONS.map((s) => [s.id, true])) as Record<SectionId, boolean>,
  layout: "detailed",
};

function loadTrip(): Trip | null {
  try {
    const raw = localStorage.getItem(TRIP_KEY);
    if (raw) {
      const t = JSON.parse(raw);
      if (isTrip(t)) return t;
    }
  } catch {}
  return null;
}

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (p && typeof p === "object") {
      const sections = { ...DEFAULT_PREFS.sections };
      for (const s of SECTIONS) if (typeof p.sections?.[s.id] === "boolean") sections[s.id] = p.sections[s.id];
      return { sections, layout: p.layout === "compact" ? "compact" : "detailed" };
    }
  } catch {}
  return DEFAULT_PREFS;
}

function saveTrip(t: Trip) {
  try {
    localStorage.setItem(TRIP_KEY, JSON.stringify(t));
  } catch {}
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Itinerary() {
  const [trip, setTrip] = useState<Trip | null>(loadTrip);
  const [example, setExample] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  // Edits go through the same reducer as the planner and are saved to this browser.
  // The planner (and its account sync) picks them up the next time it opens.
  const dispatch = useCallback((a: TripAction) => {
    // The reducer is pure and writing the same value twice is harmless, so saving inside the updater is safe.
    setTrip((cur) => {
      if (!cur) return cur;
      const next = tripReducer(cur, a);
      saveTrip(next);
      return next;
    });
  }, []);
  const edit: EditApi | undefined = useMemo(() => (trip ? { trip, dispatch } : undefined), [trip, dispatch]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  // If the planner is open in another tab, follow its changes.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TRIP_KEY) setTrip(loadTrip());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const doc = useMemo(() => {
    const shown = trip ?? (example ? sampleTrip() : null);
    return shown ? buildItinerary(shown) : null;
  }, [trip, example]);

  // The browser suggests the page title as the PDF's file name.
  useEffect(() => {
    const prev = document.title;
    if (doc) document.title = `${doc.title} · Itinerary`;
    return () => { document.title = prev; };
  }, [doc]);

  const toggleSection = (id: SectionId) => setPrefs((p) => ({ ...p, sections: { ...p.sections, [id]: !p.sections[id] } }));
  const anySection = SECTIONS.some((s) => prefs.sections[s.id]);

  return (
    <div className={styles.root} data-layout={prefs.layout}>
      <header className={`${styles.toolbar} ${styles.noPrint}`}>
        <div className={styles.toolbarRow}>
          <Link href="/" className="btn btn-ghost">
            <span aria-hidden>←</span> Back to planner
          </Link>
          <div className={styles.toolbarTitle}>
            <span className="eyebrow">Printable itinerary</span>
          </div>
          {doc && <div className={styles.toolbarActions}>
            <button type="button" className="btn" onClick={() => download(itineraryCsv(doc), csvFileName(doc))}>
              Download as spreadsheet (.csv)
            </button>
            <button type="button" className="btn btn-primary" disabled={!anySection} onClick={() => window.print()}>
              Print or save as PDF
            </button>
          </div>}
        </div>
        {doc && (
          <div className={styles.toolbarRow}>
            <fieldset className={styles.options}>
              <legend className="eyebrow">Include</legend>
              {SECTIONS.map((s) => (
                <label key={s.id} className={styles.check}>
                  <input type="checkbox" checked={prefs.sections[s.id]} onChange={() => toggleSection(s.id)} />
                  {s.label}
                </label>
              ))}
            </fieldset>
            <fieldset className={styles.options}>
              <legend className="eyebrow">Layout</legend>
              <div className={styles.segmented} role="radiogroup" aria-label="Layout">
                {(["compact", "detailed"] as const).map((l) => (
                  <label key={l} className={styles.segment} data-on={prefs.layout === l || undefined}>
                    <input type="radio" name="layout" value={l} checked={prefs.layout === l} onChange={() => setPrefs((p) => ({ ...p, layout: l }))} />
                    {l === "compact" ? "Compact" : "Detailed"}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </header>

      {doc && edit && (
        <p className={`${styles.editHint} ${styles.noPrint}`}>
          Add traveller names, confirmation numbers, day notes and bookings right on the pages below. They save in this browser, show on the printout, and sync to your account the next time you open the planner.
        </p>
      )}
      {example && !trip && (
        <p className={`${styles.notice} ${styles.noPrint}`}>
          This is the example trip. Plan your own in the planner and it will appear here.
        </p>
      )}

      {doc ? (
        anySection ? (
          <ItineraryDocument doc={doc} sections={prefs.sections} layout={prefs.layout} edit={edit} />
        ) : (
          <p className={styles.notice}>Choose at least one section to include.</p>
        )
      ) : (
        <div className={styles.empty}>
          <p className="eyebrow">Nothing to print yet</p>
          <h1 className={styles.emptyTitle}>Your itinerary will appear here</h1>
          <p>
            {trip
              ? "Add at least one city to your trip in the planner, then come back to print it or save it as a PDF."
              : "We couldn't find a trip saved in this browser. Plan one in the planner and it will appear here, ready to print or save as a PDF."}
          </p>
          <div className={styles.emptyActions}>
            <Link href="/" className="btn btn-primary">Open the planner</Link>
            {!trip && (
              <button type="button" className="btn" onClick={() => setExample(true)}>
                Preview with the example trip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
