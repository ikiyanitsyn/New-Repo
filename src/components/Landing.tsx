"use client";

import { useEffect, useId, useState, useSyncExternalStore, type Dispatch } from "react";
import { DESTINATION_CITIES, findCity, getCity, HOME_CITIES } from "@/lib/cities";
import type { TripSummary } from "@/lib/cloud/trips";
import { fmtShort } from "@/lib/format";
import {
  arrivalOffset,
  calendarMode,
  DEFAULT_STOPOVER_NIGHTS,
  groundNights,
  initialSearch,
  searchKey,
  searchProblem,
  searchStops,
  searchTripActions,
  switchTripType,
  type TripSearch,
} from "@/lib/newTrip";
import { findProgramme, programmesFor, type StopoverProgramme } from "@/lib/stopovers";
import type { Trip, TripType } from "@/lib/trip";
import type { TripAction } from "@/lib/tripReducer";
import { CityPicker } from "./CityPicker";
import { DealsSection } from "./home/DealsSection";
import { IdeasSection } from "./home/IdeasSection";
import { ideaDepartDate, ideaTripType, monthsInRange, type SeasonalIdea } from "./home/ideas";
import { MultiCityList } from "./home/MultiCityList";
import { RangeCalendar } from "./home/RangeCalendar";
import { addDaysIso, nights as nightsOf, rangeProblem, shiftMonths, type DateRange } from "./home/rangeCalendar";
import { Stepper } from "./home/Stepper";
import { StopoversSection } from "./home/StopoversSection";
import { SuggestionCards } from "./home/SuggestionCards";
import type { SuggestionAction } from "./home/suggestions";
import { TravellersPicker } from "./home/TravellersPicker";
import { TripCards } from "./home/TripCards";
import { ArrowIcon, SparkIcon } from "./icons";
import s from "./Landing.module.css";

/*
 * The home page: always the first view. A photo hero with one search
 * composer (trip type · From · To · Dates · Travellers & cabin), gentle
 * suggestions under it, then your trips, seasonal ideas, deals and airline
 * stopover programmes. The plane drifting along a dotted arc is the
 * dope.security sky motif, kept faint.
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

const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: "oneway", label: "One way" },
  { value: "round", label: "Round trip" },
  { value: "multi", label: "Multi-city" },
  { value: "stopover", label: "Stopover" },
];

interface Props {
  trip: Trip;
  dispatch: Dispatch<TripAction>;
  /** A trip is already saved on this device. */
  hasSavedTrip: boolean;
  /** Build the trip from the search first, then call this (Planner unlinks from the cloud and opens #trip). */
  onPlan: () => void;
  onConcierge: () => void;
  onContinue: () => void;
  /** Signed-in user, for recent trips from the account. */
  userId?: string | null;
  /** The cloud trip this device's trip is linked to, so it isn't listed twice. */
  linkedTripId?: string;
  /** Open a trip from the account (Planner adopts it via sync.openTrip and shows #trip). */
  onOpenTrip?: (t: TripSummary) => void;
}

export function Landing({ trip, dispatch, hasSavedTrip, onPlan, onConcierge, onContinue, userId = null, linkedTripId, onOpenTrip }: Props) {
  const ids = useId();
  const [search, setSearch] = useState<TripSearch>(() => initialSearch(trip));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>({});
  const [tried, setTried] = useState(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const photo = search.to === "SHA" || search.cities[0]?.city === "SHA" ? PHOTOS.SHA : PHOTOS.default;
  const loaded = usePhotoLoaded(photoUrl(photo));
  const still = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);

  const mode = calendarMode(search.tripType);
  const problem = searchProblem(search);
  const shownProblem = tried ? problem : null;
  const update = (patch: Partial<TripSearch>) => setSearch((x) => ({ ...x, ...patch }));
  const setType = (t: TripType) => setSearch((x) => switchTripType(x, t));

  const start = () => {
    if (problem) {
      setTried(true);
      if (problem.field === "dates") openCalendar();
      else document.getElementById(`${ids}-${problem.field}`)?.querySelector<HTMLElement>("input, button")?.focus();
      return;
    }
    searchTripActions(search).forEach(dispatch);
    onPlan();
  };
  const askConcierge = () => {
    searchTripActions(search).forEach(dispatch);
    onConcierge();
  };

  /* ---- Dates ---- */
  const openCalendar = () => {
    setDraft({ start: search.departDate, end: mode === "range" ? search.returnDate : undefined });
    setCalendarOpen(true);
  };
  const closeCalendar = (final?: DateRange) => {
    const r = final ?? draft;
    if (!rangeProblem(r, mode, today)) {
      if (mode === "range") update({ departDate: r.start!, returnDate: r.end });
      else update({ departDate: r.start! });
    }
    setCalendarOpen(false);
    requestAnimationFrame(() => document.getElementById(`${ids}-dates-btn`)?.focus());
  };

  const stops = searchStops(search);
  const totalNights = stops.reduce((n, x) => n + x.nights, 0);
  const firstStop = stops[0]?.city;
  const offset = firstStop ? arrivalOffset(getCity(search.home), getCity(firstStop)) : 0;
  const multiEnd = addDaysIso(search.departDate, totalNights + offset);
  const dateValue = mode === "range" && search.returnDate
    ? `${fmtShort(search.departDate)} → ${fmtShort(search.returnDate)}`
    : fmtShort(search.departDate);
  const dateHint = (() => {
    if (mode === "range" && search.returnDate) {
      const n = nightsOf(search.departDate, search.returnDate);
      const ground = groundNights(search);
      return offset && ground > 0 ? `${n} nights · ${ground} on the ground` : `${n} nights`;
    }
    if (search.tripType === "multi") return totalNights ? `Home about ${fmtShort(multiEnd)} · ${totalNights} nights` : "Add cities for nights";
    return null;
  })();
  const calendarNote = search.tripType === "stopover" && search.stopover?.city
    ? `Includes ${search.stopover.nights} nights in ${getCity(search.stopover.city).name}${offset ? "; you land the day after you leave" : ""}.`
    : offset && mode === "range" ? "Flights to Asia and Europe land the next day, so the first night is in the air." : undefined;

  /* ---- Ideas, deals, stopovers, suggestions fill the search ---- */
  const scrollToSearch = () => document.getElementById(`${ids}-composer`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const pickIdea = (idea: SeasonalIdea) => {
    const t = ideaTripType(idea);
    const depart = ideaDepartDate(idea, search.departDate, today);
    const nightsTotal = idea.stops.reduce((n, x) => n + x.nights, 0);
    const off = arrivalOffset(getCity(search.home), getCity(idea.stops[0].city));
    setSearch((x) => ({
      ...x,
      tripType: t,
      to: t === "multi" ? undefined : idea.stops[0].city,
      cities: t === "multi" ? idea.stops.map((st) => ({ key: searchKey(), city: st.city, nights: st.nights })) : [],
      departDate: depart,
      returnDate: addDaysIso(depart, nightsTotal + off),
      nights: nightsTotal,
    }));
    setTried(false);
    scrollToSearch();
  };

  const planStopover = (p: StopoverProgramme) => {
    if (!p.hubCity) return;
    setSearch((x) => {
      const dest = x.to ?? x.cities.find((c) => c.city !== p.hubCity)?.city;
      const hubNights = Math.min(p.maxNights ?? DEFAULT_STOPOVER_NIGHTS, x.stopover?.nights ?? DEFAULT_STOPOVER_NIGHTS);
      const next = switchTripType(x, "stopover");
      const to = dest === p.hubCity ? undefined : dest;
      const returnDate = next.returnDate && nightsOf(next.departDate, next.returnDate) >= hubNights + 2 ? next.returnDate : addDaysIso(next.departDate, hubNights + 8);
      return { ...next, to, stopover: { city: p.hubCity, nights: hubNights }, returnDate };
    });
    setTried(false);
    scrollToSearch();
  };

  const onSuggestion = (a: SuggestionAction) => {
    if (a.kind === "addCity") {
      setSearch((x) => {
        const multi = switchTripType(x, "multi");
        if (multi.cities.some((c) => c.city === a.city)) return multi;
        return { ...multi, cities: [...multi.cities, { key: searchKey(), city: a.city, nights: a.nights }] };
      });
    } else if (a.kind === "stopover") {
      const p = findProgramme(a.programme);
      if (p) planStopover(p);
    } else if (a.href.startsWith("#")) {
      // In-page target: scroll, never change the hash (the hash is the screen address).
      document.getElementById(a.href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.open(a.href, "_blank", "noreferrer");
    }
  };

  const pickMonth = (ym: string) => {
    // Move the departure into that month (same day, clamped), keeping the trip length.
    const months = (Number(ym.slice(0, 4)) - Number(search.departDate.slice(0, 4))) * 12 + Number(ym.slice(5, 7)) - Number(search.departDate.slice(5, 7));
    let depart = shiftMonths(search.departDate, months);
    if (depart < today) depart = today;
    const len = search.returnDate ? nightsOf(search.departDate, search.returnDate) : undefined;
    update({ departDate: depart, returnDate: len ? addDaysIso(depart, len) : search.returnDate });
    scrollToSearch();
  };
  const pickDestination = (code: string) => {
    if (search.tripType === "multi") {
      if (!search.cities.some((c) => c.city === code)) update({ cities: [...search.cities, { key: searchKey(), city: code, nights: 3 }] });
    } else update({ to: code });
    scrollToSearch();
  };

  const dealTo = search.tripType === "multi" ? search.cities[0]?.city : search.to;
  const routeProgrammes = dealTo ? programmesFor(search.home, dealTo).map((p) => p.id) : [];
  const chosenMonths = monthsInRange(search.departDate, mode === "range" ? search.returnDate : multiEnd);

  const missing = (f: string) => shownProblem?.field === f || undefined;

  return (
    <div className={s.home}>
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

          <form id={`${ids}-composer`} className={s.composer} data-type={search.tripType} onSubmit={(e) => { e.preventDefault(); start(); }} noValidate>
            <div className={s.types} role="radiogroup" aria-label="Trip type">
              {TRIP_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={search.tripType === t.value}
                  className={s.type}
                  onClick={() => { setType(t.value); setTried(false); }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className={s.fields}>
              <div className={`${s.part} ${s.city}`} id={`${ids}-home`} data-missing={missing("home")} data-filled>
                <span className={s.label} aria-hidden>From</span>
                <CityPicker cities={HOME_CITIES} value={search.home} onChange={(code) => update({ home: code })} placeholder="Your city" label="From: departure city" />
              </div>

              {search.tripType === "stopover" && (
                <div className={`${s.part} ${s.city}`} id={`${ids}-stopover`} data-missing={missing("stopover")} data-filled={search.stopover?.city ? true : undefined}>
                  <span className={s.label} aria-hidden>Stopover</span>
                  <CityPicker
                    cities={DESTINATION_CITIES}
                    value={search.stopover?.city}
                    onChange={(code) => update({ stopover: { nights: search.stopover?.nights ?? DEFAULT_STOPOVER_NIGHTS, city: code } })}
                    placeholder="e.g. Reykjavík"
                    label="Stopover city"
                    exclude={search.to ? [search.to] : undefined}
                  />
                  <Stepper compact value={search.stopover?.nights ?? DEFAULT_STOPOVER_NIGHTS} min={1} max={10} unit={(search.stopover?.nights ?? 2) === 1 ? "night" : "nights"} label="Nights at the stopover" onChange={(n) => update({ stopover: { ...search.stopover, nights: n } })} />
                </div>
              )}

              {search.tripType !== "multi" && (
                <div className={`${s.part} ${s.city}`} id={`${ids}-to`} data-missing={missing("to")} data-filled={search.to ? true : undefined}>
                  <span className={s.label} aria-hidden>To</span>
                  <CityPicker
                    cities={DESTINATION_CITIES}
                    value={search.to}
                    onChange={(code) => update({ to: code })}
                    placeholder="Search a city, e.g. Beijing"
                    label={search.tripType === "stopover" ? "To: destination" : "To: city"}
                    exclude={search.stopover?.city && search.tripType === "stopover" ? [search.stopover.city] : undefined}
                  />
                </div>
              )}

              <div className={`${s.part} ${s.dates}`} id={`${ids}-dates`} data-missing={missing("dates")}>
                <span className={s.label} id={`${ids}-dates-label`}>{mode === "range" ? "Depart → Return" : "Depart"}</span>
                <button
                  id={`${ids}-dates-btn`}
                  type="button"
                  className={`${s.fieldButton} data`}
                  aria-haspopup="dialog"
                  aria-expanded={calendarOpen}
                  aria-labelledby={`${ids}-dates-label ${ids}-dates-btn`}
                  onClick={() => (calendarOpen ? closeCalendar() : openCalendar())}
                >
                  {dateValue}
                </button>
                {search.tripType === "oneway" ? (
                  <Stepper compact value={search.nights} min={1} max={30} onChange={(n) => update({ nights: n })} unit={search.nights === 1 ? "night" : "nights"} label="Nights at your destination" />
                ) : (
                  dateHint && <span className={s.hint}>{dateHint}</span>
                )}
              </div>

              <div className={`${s.part} ${s.travellers}`}>
                <TravellersPicker adults={search.adults} cabin={search.cabin} labelClass={s.label} onChange={(adults, cabin) => update({ adults, cabin })} />
              </div>

              <button type="submit" className={`btn btn-primary ${s.go}`}>
                Start planning <ArrowIcon size={15} />
              </button>

              {search.tripType === "multi" && (
                <div className={s.multiWrap} id={`${ids}-cities`}>
                  <span className={s.label}>Cities</span>
                  <MultiCityList cities={search.cities} onChange={(cities) => update({ cities })} missing={missing("cities")} />
                </div>
              )}
            </div>

            {calendarOpen && (
              <RangeCalendar
                mode={mode}
                value={draft}
                min={today}
                onChange={setDraft}
                onClose={closeCalendar}
                note={calendarNote}
                label={search.to || search.cities.length ? `Return from ${getCity(stops[stops.length - 1]?.city ?? search.to!).name}` : undefined}
              />
            )}
          </form>

          <p className={s.error} role="status" aria-live="polite">{shownProblem?.message ?? ""}</p>

          <SuggestionCards search={search} onAction={onSuggestion} />

          <button type="button" className={s.describe} onClick={askConcierge}>
            <SparkIcon size={13} className={s.spark} /> Describe your trip instead
          </button>
        </div>

        {loaded && (
          <p className={s.credit}>
            <a href={photoPage(photo)} target="_blank" rel="noreferrer">{photo.caption}</a> · {photo.credit} · {photo.license}
          </p>
        )}
      </section>

      <div className={s.below}>
        <TripCards trip={trip} hasSavedTrip={hasSavedTrip} userId={userId} linkedTripId={linkedTripId} onContinue={onContinue} onOpenTrip={(t) => onOpenTrip?.(t)} />
        <IdeasSection months={chosenMonths} onPick={pickIdea} />
        <DealsSection
          from={search.home}
          to={dealTo && findCity(dealTo) ? dealTo : undefined}
          month={search.departDate.slice(0, 7)}
          nights={Math.max(1, mode === "range" && search.returnDate ? nightsOf(search.departDate, search.returnDate) : totalNights || search.nights)}
          adults={search.adults}
          cabin={search.cabin}
          onPickMonth={pickMonth}
          onPickDestination={pickDestination}
        />
        <StopoversSection highlight={routeProgrammes} onPlan={planStopover} />
      </div>
    </div>
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
