"use client";

import { useEffect, useId, useState, useSyncExternalStore, type Dispatch } from "react";
import { DESTINATION_CITIES, HOME_CITIES } from "@/lib/cities";
import { fmtShort } from "@/lib/format";
import { defaultDepartDate, guestsToAdults, newTripActions, type Guests } from "@/lib/newTrip";
import { addDays, tripNights, type Trip } from "@/lib/trip";
import type { TripAction } from "@/lib/tripReducer";
import { CityPicker } from "./CityPicker";
import { ArrowIcon, MinusIcon, PlusIcon, SparkIcon } from "./icons";
import s from "./Landing.module.css";

/*
 * Opening page, after Hopper's: one destination photo, a centred serif
 * headline and a single Where · Dates · Guests composer. The plane drifting
 * along a dotted arc is the dope.security sky motif, kept faint.
 */

interface Photo {
  file: string; // Wikimedia Commons file name (verified to exist)
  caption: string;
  credit: string;
  license: string;
}

const PHOTOS: Record<"default" | "SHA", Photo> = {
  default: { file: "The_Great_Wall_of_China_at_Jinshanling.jpg", caption: "Great Wall at Jinshanling", credit: "Vincent Ndaku", license: "CC BY-SA 3.0" },
  SHA: { file: "Pudong_Shanghai_November_2017_HDR_panorama.jpg", caption: "Pudong, Shanghai", credit: "King of Hearts", license: "CC BY-SA 4.0" },
};
const photoUrl = (p: Photo) => `https://commons.wikimedia.org/wiki/Special:FilePath/${p.file}?width=1920`;
const photoPage = (p: Photo) => `https://commons.wikimedia.org/wiki/File:${p.file}`;

const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  trip: Trip;
  dispatch: Dispatch<TripAction>;
  /** A trip is already saved on this device. */
  hasSavedTrip: boolean;
  onPlan: () => void;
  onConcierge: () => void;
  onContinue: () => void;
}

export function Landing({ trip, dispatch, hasSavedTrip, onPlan, onConcierge, onContinue }: Props) {
  const ids = useId();
  const [destination, setDestination] = useState<string | undefined>(undefined);
  const [departDate, setDepartDate] = useState(() => defaultDepartDate());
  const [nights, setNights] = useState(7);
  const [guests, setGuests] = useState<Guests>(trip.adults === 2 ? "two" : trip.adults > 2 ? "group" : "solo");
  const [groupSize, setGroupSize] = useState(Math.max(3, trip.adults));
  const [home, setHome] = useState(trip.home);
  const [missing, setMissing] = useState(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const photo = destination === "SHA" ? PHOTOS.SHA : PHOTOS.default;
  const loaded = usePhotoLoaded(photoUrl(photo));
  const still = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);

  const create = (dest: string | undefined) =>
    newTripActions({ home, destination: dest, departDate, nights, adults: guestsToAdults(guests, groupSize) }).forEach(dispatch);

  const start = () => {
    if (!destination) {
      setMissing(true);
      document.getElementById(`${ids}-where`)?.querySelector("input")?.focus();
      return;
    }
    create(destination);
    onPlan();
  };
  const askConcierge = () => {
    create(destination);
    onConcierge();
  };

  const endDate = addDays(departDate, nights + 1); // US → Asia arrives the next day
  const savedSummary = `${trip.title} · ${trip.stops.length} ${trip.stops.length === 1 ? "city" : "cities"} · ${tripNights(trip)} nights · from ${fmtShort(trip.departDate)}`;

  return (
    <section className={s.landing} aria-labelledby={`${ids}-title`}>
      <div className={s.backdrop} aria-hidden>
        <div className={s.photo} data-loaded={loaded} style={{ backgroundImage: `url("${photoUrl(photo)}")` }} key={photo.file} />
        <SkyArc still={still} />
      </div>

      <div className={s.content}>
        <p className={s.eyebrow}>Flights, trains &amp; stays · one itinerary</p>
        <h1 id={`${ids}-title`} className={`display ${s.title}`}>
          Where to <em>next</em>?
        </h1>
        <p className={s.lede}>Choose a first city and your dates. Add more stops, trains and stays once you are planning.</p>

        <form className={s.composer} onSubmit={(e) => { e.preventDefault(); start(); }} noValidate>
          <div className={`${s.part} ${s.where}`} id={`${ids}-where`} data-missing={missing || undefined} data-filled={destination ? true : undefined}>
            <span className={s.label} aria-hidden>Where</span>
            <CityPicker
              cities={DESTINATION_CITIES}
              value={destination}
              onChange={(code) => { setDestination(code); setMissing(false); }}
              placeholder="Search a city, e.g. Beijing"
              label="Where: first city"
            />
          </div>

          <div className={`${s.part} ${s.dates}`}>
            <label className={s.label} htmlFor={`${ids}-date`}>Dates</label>
            <div className={s.row}>
              <input
                id={`${ids}-date`}
                type="date"
                className={s.date}
                value={departDate}
                min={today}
                onChange={(e) => e.target.value && setDepartDate(e.target.value)}
              />
              <Stepper
                value={nights}
                min={1}
                max={30}
                onChange={setNights}
                unit={nights === 1 ? "night" : "nights"}
                label="Trip length in nights"
              />
            </div>
            <span className={s.hint}>Back about {fmtShort(endDate)}</span>
          </div>

          <div className={`${s.part} ${s.guests}`}>
            <span className={s.label} id={`${ids}-guests`}>Guests</span>
            <div className={s.row}>
              <div className="segmented" role="group" aria-labelledby={`${ids}-guests`}>
                {(["solo", "two", "group"] as const).map((g) => (
                  <button key={g} type="button" aria-pressed={guests === g} onClick={() => setGuests(g)}>
                    {g === "solo" ? "Solo" : g === "two" ? "Two" : "Group"}
                  </button>
                ))}
              </div>
              {guests === "group" && (
                <Stepper value={groupSize} min={3} max={9} onChange={setGroupSize} unit="people" label="Group size" />
              )}
            </div>
          </div>

          <button type="submit" className={`btn btn-primary ${s.go}`}>
            Start planning <ArrowIcon size={15} />
          </button>
        </form>

        <p className={s.error} role="status" aria-live="polite">
          {missing ? "Choose a first city to start, or let the concierge suggest a route." : ""}
        </p>

        <div className={s.actions}>
          {hasSavedTrip && (
            <button type="button" className={s.action} onClick={onContinue}>
              <span>Continue your trip</span>
              <span className={s.actionMeta}>{savedSummary}</span>
            </button>
          )}
          <button type="button" className={s.action} onClick={askConcierge}>
            <span><SparkIcon size={14} className={s.spark} /> Let the concierge plan it</span>
            <span className={s.actionMeta}>Describe the trip, get a day-by-day plan</span>
          </button>
          {!hasSavedTrip && (
            <button type="button" className={s.action} onClick={onContinue}>
              <span>Explore the example trip</span>
              <span className={s.actionMeta}>Beijing to Hong Kong in 15 nights</span>
            </button>
          )}
        </div>

        <div className={s.from}>
          <label htmlFor={`${ids}-home`}>Flying from</label>
          <select id={`${ids}-home`} value={home} onChange={(e) => setHome(e.target.value)}>
            {HOME_CITIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          {hasSavedTrip && <span className={s.note}>A new trip replaces the one saved on this device.</span>}
        </div>
      </div>

      {loaded && (
        <p className={s.credit}>
          <a href={photoPage(photo)} target="_blank" rel="noreferrer">{photo.caption}</a> · {photo.credit} · {photo.license}
        </p>
      )}
    </section>
  );
}

/** True once the photo has loaded; stays false when images are blocked (the gradient shows instead). */
function usePhotoLoaded(url: string) {
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => { if (live) setLoaded(url); };
    img.src = url;
    return () => { live = false; };
  }, [url]);
  return loaded === url;
}

function Stepper({ value, min, max, onChange, unit, label }: { value: number; min: number; max: number; onChange: (n: number) => void; unit: string; label: string }) {
  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${unit}`}>
        <MinusIcon size={14} />
      </button>
      <span className="data" aria-live="polite">{value} <span className={s.unit}>{unit}</span></span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${unit}`}>
        <PlusIcon size={14} />
      </button>
    </div>
  );
}

// A quadratic arc across the sky (viewBox units). The plane rides it; reduced motion parks it.
// It arcs over the headline; a CSS mask fades it out behind the centred text.
const ARC = { x0: -60, y0: 600, cx: 760, cy: -170, x1: 1500, y1: 320 };
const ARC_PATH = `M${ARC.x0} ${ARC.y0} Q${ARC.cx} ${ARC.cy} ${ARC.x1} ${ARC.y1}`;
function arcPoint(t: number) {
  const u = 1 - t;
  const x = u * u * ARC.x0 + 2 * u * t * ARC.cx + t * t * ARC.x1;
  const y = u * u * ARC.y0 + 2 * u * t * ARC.cy + t * t * ARC.y1;
  const dx = 2 * u * (ARC.cx - ARC.x0) + 2 * t * (ARC.x1 - ARC.cx);
  const dy = 2 * u * (ARC.cy - ARC.y0) + 2 * t * (ARC.y1 - ARC.cy);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}
const PARKED = arcPoint(0.08); // left edge, clear of the composer

function SkyArc({ still }: { still: boolean }) {
  return (
    <svg className={s.sky} viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice">
      <path d={ARC_PATH} className={s.arc} />
      <g className={s.plane} transform={still ? `translate(${PARKED.x} ${PARKED.y}) rotate(${PARKED.angle})` : undefined}>
        {/* A small airliner pointing along +x, so rotate="auto" keeps it nose-first */}
        <path d="M13 0c0-1.2-1.6-1.9-3.6-1.9H4.2L-3.2-11h-3l3.6 9.1h-6.1l-2.5-3.4h-2.3l1.5 5.3-1.5 5.3h2.3l2.5-3.4h6.1L-6.2 11h3l7.4-9.1h5.2C11.4 1.9 13 1.2 13 0Z" />
        {!still && (
          <>
            <animateMotion dur="34s" repeatCount="indefinite" rotate="auto" path={ARC_PATH} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
            <animate attributeName="opacity" dur="34s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.08;0.9;1" />
          </>
        )}
      </g>
    </svg>
  );
}
