"use client";

import dynamic from "next/dynamic";
import { PlaneLoader } from "./PlaneLoader";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtShort } from "@/lib/format";
import { readHotelsCache, writeHotelsCache } from "@/lib/hotels/cache";
import { hotelBookingUrl, parseTypedPrice, toChosenHotel } from "@/lib/hotels/choose";
import { fmtChecked, fmtUsd, nightlyLine, pinPriceLabel } from "@/lib/hotels/format";
import { isLivePlaceId, livePlace, matchHotels } from "@/lib/hotels/match";
import type { HotelsResult, HotelsStatus, LiveHotel } from "@/lib/hotels/types";
import { approxUsd, fmtCount, priceShort, priceSymbol, stayPinLabel } from "@/lib/places/display";
import { placeLinks, staySearchLinks, type OutLink } from "@/lib/places/links";
import { findPlaceByName, nameSimilarity } from "@/lib/places/match";
import { featureScore, picksFor, subcategoryOf, subcategoryOrder } from "@/lib/places/subcategory";
import {
  CATEGORY_LABEL, type Comfort, type Place, type PlaceCategory, type PlaceRating, type PlacesResult, type RatingsProviderInfo, type RatingsResult,
} from "@/lib/places/types";
import { placeKey, type ChosenHotel, type SavedPlace, type StopWithDates } from "@/lib/trip";
import {
  ArrowIcon, BagIcon, BedIcon, ColumnsIcon, CompassIcon, ExternalIcon, ForkIcon, GlassIcon, HeartIcon, ListIcon, MapIcon,
} from "./icons";

const CityMap = dynamic(() => import("./CityMap"), { ssr: false, loading: () => <div className="city-map-wrap" /> });

interface Props {
  stops: StopWithDates[];
  stopId: string;
  adults: number;
  saved: SavedPlace[];
  onToggleSave: (p: SavedPlace) => void;
  onNavigate: (stopId: string) => void;
  onClose: () => void;
  /** The traveller's comfort level (from the concierge's preferences); steers the picks. */
  comfort?: Comfort;
  /** Open this place's page once the guide loads (deep link from the concierge or the URL). */
  initialPlaceName?: string;
  /** The hotel the traveller chose for this stop, if any. */
  hotel?: ChosenHotel;
  /** Save (or, with null, clear) the chosen hotel for this stop. */
  onChooseHotel?: (hotel: ChosenHotel | null) => void;
  /** Add a place to a day of the itinerary. Returns false when that day isn't in the plan. */
  onAddToPlan?: (place: Place, date: string, time: string) => boolean;
}

type Tab = PlaceCategory | "saved";

const TABS: { id: Tab; icon: (p: { size?: number }) => React.ReactElement }[] = [
  { id: "sleep", icon: BedIcon },
  { id: "see", icon: ColumnsIcon },
  { id: "do", icon: CompassIcon },
  { id: "eat", icon: ForkIcon },
  { id: "drink", icon: GlassIcon },
  { id: "buy", icon: BagIcon },
];

const HEADLINE: Record<PlaceCategory, (city: string) => string> = {
  sleep: (c) => `Where to stay in ${c}`,
  see: (c) => `What to see in ${c}`,
  do: (c) => `Things to do in ${c}`,
  eat: (c) => `Where to eat in ${c}`,
  drink: (c) => `Where to drink in ${c}`,
  buy: (c) => `Where to shop in ${c}`,
};

const LIST_STEP = 8;
/** How many of a category's best-documented places to rate up front, as pick candidates. */
const PICK_CANDIDATES = 8;
const RATINGS_BATCH = 12;

/** First sentence of a description, for one calm line under a name. */
function hook(p: Place, max = 120): string | undefined {
  if (!p.description) return undefined;
  const first = p.description.split(/(?<=[.!?])\s/)[0];
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}

type Ratings = Record<string, PlaceRating | null>;

/** Is a guide or price-result hotel the one the traveller chose? Same name, near enough. */
function sameHotel(hotel: ChosenHotel | undefined, p: Place, cityName: string): boolean {
  return !!hotel && nameSimilarity(hotel.name, p.name, [cityName]) >= 0.9;
}

export function CityExplorer({ stops, stopId, adults, saved, onToggleSave, onNavigate, onClose, comfort, initialPlaceName, hotel, onChooseHotel, onAddToPlan }: Props) {
  const index = Math.max(0, stops.findIndex((s) => s.id === stopId));
  const stop = stops[index];
  const city = stop.cityInfo;
  const prev = stops[index - 1];
  const next = stops[index + 1];

  const [seenIndex, setSeenIndex] = useState(index);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  if (index !== seenIndex) {
    setDirection(index > seenIndex ? "next" : "prev");
    setSeenIndex(index);
  }

  const [tab, setTab] = useState<Tab>("sleep");
  const [sub, setSub] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [shown, setShown] = useState(LIST_STEP);
  const [phoneView, setPhoneView] = useState<"list" | "map">("list");

  // Desktop: the list is a panel that slides over a full-screen map. The map keeps the uncovered part centred.
  const [panelOpen, setPanelOpen] = useState(true);
  const guideRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(0); // 0 on phones, where the list and map take turns
  useEffect(() => {
    const el = guideRef.current;
    if (!el) return;
    const wide = window.matchMedia("(min-width: 861px)");
    const measure = () => setPanelWidth(wide.matches ? el.offsetWidth : 0);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    wide.addEventListener("change", measure);
    return () => { ro.disconnect(); wide.removeEventListener("change", measure); };
  }, []);

  const [state, setState] = useState<{ city: string; data?: PlacesResult; error?: string } | null>(null);
  const loading = state?.city !== city.code;
  const data = loading ? null : state?.data ?? null;
  const error = loading ? null : data?.error ?? state?.error ?? null;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/places?city=${city.code}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Couldn't load places");
        setState({ city: city.code, data: j });
      })
      .catch((e) => { if (e.name !== "AbortError") setState({ city: city.code, error: e.message }); });
    return () => ctrl.abort();
  }, [city.code]);

  // Ratings, fetched lazily for what's on screen. provider: undefined = not asked yet, null = none configured.
  const [rated, setRated] = useState<{ city: string; provider?: RatingsProviderInfo | null; map: Ratings }>({ city: "", map: {} });
  const ratingsHere = rated.city === city.code ? rated : { city: city.code, provider: undefined, map: {} as Ratings };
  const ratings = ratingsHere.map;
  const provider = ratingsHere.provider;
  const asked = useRef(new Set<string>());

  // Live hotel prices: only when the traveller asks (each ask spends one of the monthly SerpApi searches).
  const liveKey = `${city.code}|${stop.arrive}|${stop.depart}|${adults}`;
  const [live, setLive] = useState<{ key: string; phase: "loading" | "ok" | "error"; data?: HotelsResult; error?: string } | null>(null);
  const [hstatus, setHstatus] = useState<HotelsStatus | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/hotels?status=1", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setHstatus(j); })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  // Prices from the last 12 hours that the browser already holds: free to show.
  const stored = useMemo(() => (typeof window === "undefined" ? null : readHotelsCache(liveKey)), [liveKey]);
  const liveHere = live?.key === liveKey ? live : null;
  const liveData = liveHere?.data ?? (liveHere?.phase === "error" ? null : stored);
  const liveLoading = liveHere?.phase === "loading";
  const showLive = () => {
    const key = liveKey;
    setLive({ key, phase: "loading" });
    const qs = new URLSearchParams({ city: city.code, checkin: stop.arrive, checkout: stop.depart, adults: String(adults) });
    fetch(`/api/hotels?${qs}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) {
          if (j.code === "no_key") setHstatus((h) => ({ quota: { used: 0, limit: 0 }, ...h, available: false }));
          throw new Error(j.error || "Couldn't get live prices");
        }
        writeHotelsCache(key, j);
        setHstatus((h) => ({ available: true, ...h, quota: j.quota }));
        setLive({ key, phase: "ok", data: j });
      })
      .catch((e) => setLive({ key, phase: "error", error: e.message }));
  };

  const savedKeys = useMemo(() => new Set(saved.map((s) => s.key)), [saved]);
  const all = useMemo(() => data?.places ?? [], [data]);
  const withSub = useMemo(() => all.map((p) => ({ place: p, sub: subcategoryOf(p) })), [all]);
  const matches = useMemo(
    () => (liveData ? matchHotels(all.filter((p) => p.category === "sleep"), liveData.hotels, city) : null),
    [liveData, all, city],
  );
  const liveOnly = useMemo(
    () => (matches && liveData ? matches.unmatched.map((h) => livePlace(h, liveData.hotels.indexOf(h))) : []),
    [matches, liveData],
  );
  const liveById = useMemo(() => {
    const m: Record<string, LiveHotel> = { ...(matches?.byPlaceId ?? {}) };
    liveOnly.forEach((p, i) => { m[p.id] = matches!.unmatched[i]; });
    return m;
  }, [matches, liveOnly]);
  const stayPlaces = useMemo(() => [...all.filter((p) => p.category === "sleep"), ...liveOnly], [all, liveOnly]);
  const chosenPlace = hotel ? stayPlaces.find((p) => sameHotel(hotel, p, city.name)) : undefined;

  // Deep link: once the guide loads, open the named place on its own tab.
  const deepKey = data && initialPlaceName ? `${city.code}|${initialPlaceName}` : null;
  const [appliedDeep, setAppliedDeep] = useState<string | null>(null);
  if (deepKey && deepKey !== appliedDeep) {
    setAppliedDeep(deepKey);
    const hit = findPlaceByName(all, initialPlaceName);
    if (hit) { setTab(hit.category); setSub("all"); setShown(LIST_STEP); setDetailId(hit.id); }
  }

  const inTab = useMemo(
    () => (tab === "saved" ? withSub.filter((x) => savedKeys.has(placeKey(x.place.name))) : withSub.filter((x) => x.place.category === tab)),
    [withSub, tab, savedKeys],
  );
  const subs = useMemo(() => {
    if (tab === "saved") return [];
    const present = new Set(inTab.map((x) => x.sub));
    return subcategoryOrder(tab).filter((s) => present.has(s));
  }, [inTab, tab]);
  const visible = useMemo(() => (sub === "all" ? inTab : inTab.filter((x) => x.sub === sub)).map((x) => x.place), [inTab, sub]);
  const picks = useMemo(
    () => (tab !== "saved" && sub === "all" && visible.length > 5 ? picksFor(visible, tab, { ratings, comfort }) : []),
    [visible, tab, sub, ratings, comfort],
  );
  const pickIds = new Set(picks.map((p) => p.place.id));
  const rest = visible.filter((p) => !pickIds.has(p.id));
  const detail = all.find((p) => p.id === detailId) ?? liveOnly.find((p) => p.id === detailId) ?? null;
  const tabCount = (t: Tab) => (t === "saved" ? saved.length : all.filter((p) => p.category === t).length);
  const tabs = TABS.filter((t) => t.id !== "buy" || tabCount("buy") > 0);

  // Which places to rate: the pick candidates, the rows on screen and the open place.
  const wanted = useMemo(() => {
    if (!data || data.error) return [];
    if (detailId) return isLivePlaceId(detailId) ? [] : [detailId];
    const candidates = tab === "saved" ? [] : [...visible].sort((a, b) => featureScore(b) - featureScore(a)).slice(0, PICK_CANDIDATES);
    const onScreen = visible.slice(0, shown + 3);
    return [...new Set([...candidates, ...onScreen].map((p) => p.id))];
  }, [data, detailId, tab, visible, shown]);
  const wantedKey = wanted.join(",");

  useEffect(() => {
    if (provider === null || !wantedKey) return;
    const code = city.code;
    const ids = wantedKey.split(",").filter((id) => !asked.current.has(`${code}:${id}`));
    for (let i = 0; i < ids.length; i += RATINGS_BATCH) {
      const batch = ids.slice(i, i + RATINGS_BATCH).sort();
      batch.forEach((id) => asked.current.add(`${code}:${id}`));
      // Not aborted on re-render: these ids are marked as asked, so the answer must land.
      fetch(`/api/places/ratings?city=${code}&ids=${batch.join(",")}`)
        .then((r) => (r.ok ? (r.json() as Promise<RatingsResult>) : null))
        .then((j) => {
          if (!j) return;
          setRated((prev) => {
            const base = prev.city === code ? prev.map : {};
            return { city: code, provider: j.provider, map: { ...base, ...j.ratings } };
          });
        })
        .catch(() => {});
    }
  }, [wantedKey, city.code, provider]);

  const reset = () => { setSub("all"); setDetailId(null); setShown(LIST_STEP); };
  const chooseTab = (t: Tab) => { setTab(t); reset(); };
  const go = (s?: StopWithDates) => { if (s) { reset(); onNavigate(s.id); } };
  const toggleSave = (p: Place) => onToggleSave({ key: placeKey(p.name), name: p.name, category: p.category, lat: p.lat, lon: p.lon });
  const open = (id: string) => { setDetailId(id); setPhoneView("list"); document.querySelector(".explorer-body")?.scrollTo({ top: 0 }); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, select, textarea, .city-map")) return;
      if (e.key === "Escape") { if (detailId) setDetailId(null); else onClose(); }
      else if (e.key === "ArrowRight") go(next);
      else if (e.key === "ArrowLeft") go(prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) go(dx < 0 ? next : prev);
  };

  const nightsCount = stop.nights;
  const bookingFor = (name: string) => hotelBookingUrl(name, city, stop.arrive, stop.depart, adults);
  const choose = (p: Place, manual?: number) =>
    onChooseHotel?.(toChosenHotel({
      name: p.name, lat: p.lat, lon: p.lon,
      live: liveById[p.id], livePricedAt: liveData?.fetchedAt,
      manualNightly: manual, bookingUrl: bookingFor(p.name),
    }));
  const setManualPrice = (nightly: number) => {
    if (!hotel) return;
    onChooseHotel?.({ ...hotel, nightly, source: "manual", pricedAt: new Date().toISOString() });
  };
  const listRef = useRef<HTMLDivElement>(null);
  const stays = staySearchLinks(city, stop.arrive, stop.depart, adults);
  const role = index === 0 ? "Arriving" : index === stops.length - 1 ? "Final stop" : `Stop ${index + 1} of ${stops.length}`;
  const mapPlaces = useMemo(
    () => (detail ? [detail] : tab === "sleep" && sub === "all" ? [...visible, ...liveOnly] : visible),
    [detail, visible, liveOnly, tab, sub],
  );
  const pinLabels: Record<string, string> = {};
  for (const p of mapPlaces) {
    if (p.category !== "sleep") continue;
    // A live price beats the guide's price text and the rating. Pills show the nightly price, "$142".
    // Once live prices are on, pills without one stay plain beds, so every "$142" on the map is a live price.
    const label = pinPriceLabel(liveById[p.id]?.nightly) ?? (liveData ? undefined : stayPinLabel(p, ratings[p.id], !!provider?.showOnMap));
    if (label) pinLabels[p.id] = label;
  }
  const myHotelPos = hotel
    ? hotel.lat !== undefined && hotel.lon !== undefined
      ? { name: hotel.name, lat: hotel.lat, lon: hotel.lon }
      : chosenPlace?.lat !== undefined && chosenPlace.lon !== undefined
        ? { name: hotel.name, lat: chosenPlace.lat, lon: chosenPlace.lon }
        : null
    : null;
  const anyRated = provider && visible.some((p) => ratings[p.id]?.rating !== undefined);
  const isStays = tab === "sleep";

  const card = (p: Place, label?: string) =>
    isStays ? (
      <StayCard
        key={p.id}
        country={city.country}
        place={p}
        label={label}
        sub={subcategoryOf(p)}
        rating={ratings[p.id]}
        live={liveById[p.id]}
        chosen={sameHotel(hotel, p, city.name)}
        onChoose={onChooseHotel ? () => choose(p) : undefined}
        saved={savedKeys.has(placeKey(p.name))}
        onSave={() => toggleSave(p)}
        onOpen={() => open(p.id)}
        onHover={(on) => setHoverId(on ? p.id : null)}
      />
    ) : (
      <PickCard
        key={p.id}
        place={p}
        label={label ?? ""}
        rating={ratings[p.id]}
        saved={savedKeys.has(placeKey(p.name))}
        onSave={() => toggleSave(p)}
        onOpen={() => open(p.id)}
        onHover={(on) => setHoverId(on ? p.id : null)}
      />
    );

  return (
    <section className="explorer" data-view={phoneView} data-panel={panelOpen ? "open" : "closed"} aria-label={`Explore ${city.name}`}>
      <div id="explorer-panel" ref={guideRef} className="explorer-guide" inert={!panelOpen && panelWidth > 0} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Hero: the city's banner photo when the guide has one */}
        <div
          key={`hero-${city.code}`}
          className={`explorer-hero explorer-slide-${direction} ${data?.banner ? "has-photo" : ""}`}
          style={data?.banner ? { backgroundImage: `url("${data.banner}")` } : undefined}
        >
          <div className="explorer-hero-bar">
            <button type="button" className="hero-pill" onClick={onClose}>
              <ArrowIcon size={14} className="rotate-180" /> Route
            </button>
            <div className="flex items-center gap-1.5">
              <button type="button" className="hero-pill" disabled={!prev} onClick={() => go(prev)} aria-label={prev ? `Previous city: ${prev.cityInfo.name}` : "No previous city"}>
                <ArrowIcon size={14} className="rotate-180" />
              </button>
              <button type="button" className="hero-pill" disabled={!next} onClick={() => go(next)} aria-label={next ? `Next city: ${next.cityInfo.name}` : "No next city"}>
                {next && <span className="hidden sm:inline">{next.cityInfo.name}</span>} <ArrowIcon size={14} />
              </button>
            </div>
          </div>
          <div className="explorer-hero-text">
            <div className="hero-eyebrow">{role} · {fmtShort(stop.arrive)} – {fmtShort(stop.depart)} · {stop.nights} {stop.nights === 1 ? "night" : "nights"}</div>
            <h2 className="display hero-title">
              {city.name}
              {city.localName && <span className="hero-local">{city.localName}</span>}
            </h2>
          </div>
        </div>

        <nav className="explorer-tabs" role="tablist" aria-label="Kinds of places">
          {tabs.map(({ id, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => chooseTab(id)}>
              <Icon size={20} />
              <span>{CATEGORY_LABEL[id as PlaceCategory]}</span>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={tab === "saved"} onClick={() => chooseTab("saved")}>
            <HeartIcon size={20} filled={saved.length > 0} />
            <span>Saved{saved.length ? ` · ${saved.length}` : ""}</span>
          </button>
        </nav>

        <div key={`${city.code}-${tab}-${detailId ?? ""}`} className={`explorer-body scroll-y explorer-slide-${direction}`}>
          {detail ? (
            <PlaceDetail
              country={city.country}
              place={detail}
              sub={subcategoryOf(detail)}
              rating={ratings[detail.id]}
              ratingPending={!!provider && !(detail.id in ratings)}
              provider={provider ?? null}
              saved={savedKeys.has(placeKey(detail.name))}
              onSave={() => toggleSave(detail)}
              onBack={() => setDetailId(null)}
              backLabel={tab === "saved" ? "Saved" : CATEGORY_LABEL[tab]}
              links={[
                ...(detail.category === "sleep" ? [{ label: "Booking.com", url: bookingFor(detail.name) }] : []),
                ...placeLinks(detail, city),
                ...(liveById[detail.id]?.link ? [{ label: /google\./.test(liveById[detail.id].link!) ? "Google Hotels" : "Hotel website", url: liveById[detail.id].link! }] : []),
              ]}
              live={liveById[detail.id]}
              livePricedAt={liveData?.fetchedAt}
              nights={nightsCount}
              addToPlan={onAddToPlan && detail.category !== "sleep" ? { stop, onAdd: (date, time) => onAddToPlan(detail, date, time) } : undefined}
              chosen={sameHotel(hotel, detail, city.name)}
              chosenSource={hotel?.source}
              onChoose={onChooseHotel && detail.category === "sleep" ? (manual) => choose(detail, manual) : undefined}
            />
          ) : (
            <div className="flex flex-col gap-6 px-6 pb-10 pt-6">
              <h3 className="display text-[26px] leading-tight">
                {tab === "saved" ? `Your saved places in ${city.name}` : HEADLINE[tab](city.name)}
              </h3>

              {isStays && hotel && (
                <MyHotelCard
                  hotel={hotel}
                  nights={nightsCount}
                  onChange={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  onRemove={() => onChooseHotel?.(null)}
                  onPrice={setManualPrice}
                  canEdit={!!onChooseHotel}
                />
              )}

              {isStays && (
                <div className="stay-cta">
                  <div>
                    <div className="text-[15px] font-medium">Check prices for your dates</div>
                    <div className="text-[14px] text-ink-2">{fmtShort(stop.arrive)} – {fmtShort(stop.depart)} · {adults} {adults === 1 ? "guest" : "guests"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={stays[0].url} target="_blank" rel="noopener noreferrer" className="btn btn-primary !h-10">
                      {stays[0].label} <ExternalIcon size={12} />
                    </a>
                    {stays.slice(1).map((l) => (
                      <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="btn !h-10">
                        {l.label} <ExternalIcon size={12} />
                      </a>
                    ))}
                  </div>
                  <div className="live-row">
                    {liveData ? (
                      <p className="live-note">
                        <strong>Live prices</strong> from Google Hotels (via SerpApi), checked {fmtChecked(liveData.fetchedAt)}.
                        Taxes and fees are included where Google shows them. Prices change, so confirm when you book.
                      </p>
                    ) : hstatus?.available === false ? (
                      <p className="live-note">Live prices need a SerpApi key.</p>
                    ) : (
                      <>
                        <button type="button" className="btn !h-10" disabled={liveLoading || !hstatus} onClick={showLive}>
                          {liveLoading ? "Checking prices…" : "Show live prices"}
                        </button>
                        {liveLoading && <PlaneLoader label="Checking hotel prices" />}
                        {hstatus && <span className="live-note">Uses 1 of {Math.max(0, hstatus.quota.limit - hstatus.quota.used)} searches left this month.</span>}
                      </>
                    )}
                    {liveHere?.phase === "error" && <p className="live-note live-error" role="alert">{liveHere.error}</p>}
                  </div>
                </div>
              )}

              {subs.length > 1 && (
                <div className="sub-chips" role="group" aria-label="Narrow down">
                  {["all", ...subs].map((s) => (
                    <button key={s} type="button" aria-pressed={sub === s} onClick={() => { setSub(s); setShown(LIST_STEP); }}>
                      {s === "all" ? "Everything" : s}
                    </button>
                  ))}
                </div>
              )}

              {loading && (
                <div className="flex flex-col gap-3">
                  <div className="skeleton h-[200px]" />
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-[64px]" />)}
                </div>
              )}

              {error && (
                <div className="rounded-lg px-4 py-4 text-[14px]" style={{ background: "var(--surface-sunk)" }}>
                  <p>{error}</p>
                  <p className="mt-1 text-ink-2">
                    You can still browse {city.name} on{" "}
                    <a className="underline" href={`https://www.tripadvisor.com/Search?q=${encodeURIComponent(city.name)}`} target="_blank" rel="noopener noreferrer">TripAdvisor</a>.
                  </p>
                </div>
              )}

              {!loading && !error && visible.length === 0 && (
                <p className="py-6 text-[15px] text-ink-2">
                  {tab === "saved"
                    ? "Tap the heart on any place to keep it here. The trip concierge will plan around your saved places."
                    : `The guide has no ${CATEGORY_LABEL[tab].toLowerCase()} listings for ${city.name} yet.`}
                </p>
              )}

              {picks.length > 0 && (
                <section aria-label="Our picks" className="flex flex-col gap-3">
                  <div className="eyebrow">
                    Our picks{comfort && (tab === "sleep" || tab === "eat") ? ` · leaning ${comfort.toLowerCase()}` : ""}
                  </div>
                  <div className={isStays ? "stay-grid" : "picks"}>
                    {picks.map(({ place, label }) => card(place, label))}
                  </div>
                </section>
              )}

              {rest.length > 0 && (
                <section aria-label="All places" ref={listRef} className="flex flex-col gap-1 scroll-mt-4">
                  {picks.length > 0 && <div className="eyebrow pb-2">{isStays ? "More stays" : "More to explore"} · {rest.length}</div>}
                  {isStays ? (
                    <div className="stay-grid">{rest.slice(0, shown).map((p) => card(p))}</div>
                  ) : (
                    <ul className="flex flex-col">
                      {rest.slice(0, shown).map((p) => (
                        <PlaceRow
                          key={p.id}
                          place={p}
                          sub={tab === "saved" ? CATEGORY_LABEL[p.category] : subcategoryOf(p)}
                          rating={ratings[p.id]}
                          saved={savedKeys.has(placeKey(p.name))}
                          onSave={() => toggleSave(p)}
                          onOpen={() => open(p.id)}
                          onHover={(on) => setHoverId(on ? p.id : null)}
                        />
                      ))}
                    </ul>
                  )}
                  {rest.length > shown && (
                    <button type="button" className="btn mt-4 self-start" onClick={() => setShown((n) => n + LIST_STEP * 2)}>
                      Show {Math.min(LIST_STEP * 2, rest.length - shown)} more
                    </button>
                  )}
                </section>
              )}

              {isStays && !detail && sub === "all" && liveOnly.length > 0 && (
                <section aria-label="More hotels with live prices" className="flex flex-col gap-3">
                  <div className="eyebrow">Also available for your dates · {liveOnly.length}</div>
                  <div className="stay-grid">{liveOnly.map((p) => card(p))}</div>
                </section>
              )}

              {data && !data.error && (
                <p className="pt-2 text-[12.5px] leading-relaxed text-ink-3">
                  From the free travel guide{" "}
                  <a href={data.articleUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Wikivoyage</a>
                  {" "}(text CC BY-SA) and Wikimedia photos.
                  {anyRated && <> Ratings from {provider!.name}.</>}
                  {liveData && isStays && <> Hotel prices and some ratings from Google Hotels via SerpApi.</>} Confirm opening times with the venue.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <CityMap
        city={city}
        places={mapPlaces}
        activeId={detailId}
        hoverId={hoverId}
        pinLabels={pinLabels}
        onSelect={open}
        leftPad={panelOpen ? panelWidth : 0}
        myHotel={myHotelPos}
        myHotelPlaceId={chosenPlace && chosenPlace.lat !== undefined ? chosenPlace.id : null}
      />

      <button
        type="button"
        className="panel-handle"
        aria-expanded={panelOpen}
        aria-controls="explorer-panel"
        aria-label={panelOpen ? "Hide the list" : "Show the list"}
        onClick={() => setPanelOpen((v) => !v)}
      >
        <ArrowIcon size={16} className={panelOpen ? "rotate-180" : ""} />
      </button>

      <button type="button" className="map-toggle" onClick={() => setPhoneView((v) => (v === "list" ? "map" : "list"))}>
        {phoneView === "list" ? <><MapIcon size={16} /> Map</> : <><ListIcon size={16} /> List</>}
      </button>
    </section>
  );
}

/** "Choose as my hotel", with an optional price field for hotels that have no live price. */
function ChooseHotel({ chosen, chosenSource, hasLivePrice, onChoose }: {
  chosen: boolean; chosenSource?: ChosenHotel["source"]; hasLivePrice: boolean; onChoose: (manual?: number) => void;
}) {
  const [text, setText] = useState("");
  const typed = hasLivePrice ? undefined : parseTypedPrice(text);
  return (
    <div className="flex flex-col gap-2">
      {!hasLivePrice && (
        <label className="manual-price">
          <span>Enter the price you found <span className="text-ink-3">(optional, USD a night)</span></span>
          <span className="manual-input">
            <span aria-hidden="true">$</span>
            <input inputMode="decimal" placeholder="e.g. 120" value={text} onChange={(e) => setText(e.target.value)} />
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" disabled={chosen && typed === undefined} onClick={() => onChoose(typed)}>
          {chosen ? (typed !== undefined ? "Update my hotel" : "This is my hotel") : "Choose as my hotel"}
        </button>
        {chosen && chosenSource && <span className="text-[13px] text-ink-3">Saved to your trip.</span>}
      </div>
    </div>
  );
}

/** The chosen hotel, large, at the top of the Stay tab. */
function MyHotelCard({ hotel, nights, onChange, onRemove, onPrice, canEdit }: {
  hotel: ChosenHotel; nights: number; onChange: () => void; onRemove: () => void; onPrice: (n: number) => void; canEdit: boolean;
}) {
  const [text, setText] = useState("");
  const typed = parseTypedPrice(text);
  const where = hotel.source === "google_hotels" ? "Google Hotels" : hotel.source === "manual" ? "the price you entered" : "";
  return (
    <section className="my-hotel" aria-label="My hotel">
      <div className="eyebrow !text-accent">Your hotel</div>
      <h3 className="display my-hotel-name">{hotel.name}</h3>
      {hotel.nightly !== undefined ? (
        <p className="text-[15px] text-ink-2">
          <strong className="text-ink">{nightlyLine(hotel.nightly, nights)}</strong>
          {where && <> · from {where}{hotel.pricedAt ? `, checked ${fmtChecked(hotel.pricedAt)}` : ""}</>}
        </p>
      ) : (
        canEdit && (
          <div className="manual-price">
            <span>No price yet. Enter the price you found <span className="text-ink-3">(USD a night)</span></span>
            <span className="flex items-center gap-2">
              <span className="manual-input">
                <span aria-hidden="true">$</span>
                <input inputMode="decimal" placeholder="e.g. 120" value={text} onChange={(e) => setText(e.target.value)} aria-label="Nightly price in US dollars" />
              </span>
              <button type="button" className="btn !h-10" disabled={typed === undefined} onClick={() => { if (typed !== undefined) onPrice(typed); }}>Save price</button>
            </span>
          </div>
        )
      )}
      <div className="flex flex-wrap items-center gap-2">
        {hotel.bookingUrl && (
          <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary !h-10">
            Book on Booking.com <ExternalIcon size={12} />
          </a>
        )}
        {canEdit && <button type="button" className="btn !h-10" onClick={onChange}>Change</button>}
        {canEdit && <button type="button" className="btn btn-ghost !h-10" onClick={onRemove}>Remove</button>}
      </div>
    </section>
  );
}

function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="star-icon">
      <path fill="currentColor" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
    </svg>
  );
}

/** "★ 4.7 · 1,203" in one calm line. Renders nothing without a rating. */
function RatingLine({ rating, long }: { rating?: PlaceRating | null; long?: boolean }) {
  if (rating?.rating === undefined) return null;
  return (
    <span className="rating-line" aria-label={`Rated ${rating.rating.toFixed(1)} out of 5${rating.count ? ` by ${fmtCount(rating.count)} people` : ""}`}>
      <StarIcon />
      <span className="rating-num">{rating.rating.toFixed(1)}</span>
      {rating.count !== undefined && <span className="rating-count">({fmtCount(rating.count)}{long ? ` ${rating.count === 1 ? "review" : "reviews"}` : ""})</span>}
    </span>
  );
}

function SaveButton({ saved, onSave, name, overlay }: { saved: boolean; onSave: () => void; name: string; overlay?: boolean }) {
  return (
    <button
      type="button"
      className={`save-btn ${overlay ? "overlay" : ""} ${saved ? "on" : ""}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      onClick={(e) => { e.stopPropagation(); onSave(); }}
    >
      <HeartIcon size={18} filled={saved} />
    </button>
  );
}

interface CardProps {
  place: Place;
  rating?: PlaceRating | null;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  onHover: (on: boolean) => void;
}

/** A stay, listing-card style: big photo, name and rating, a short hook, the price. */
function StayCard({ place: p, label, sub, rating, live, chosen, onChoose, saved, onSave, onOpen, onHover, country }: CardProps & {
  label?: string; sub: string; live?: LiveHotel; chosen: boolean; onChoose?: () => void; country?: string;
}) {
  const [imgOk, setImgOk] = useState(true);
  const price = priceShort(p.price);
  const usd = approxUsd(price, country);
  const symbol = priceSymbol(p, rating);
  const shownRating: PlaceRating | null | undefined =
    rating?.rating !== undefined || live?.rating === undefined ? rating : { rating: live.rating, count: live.reviews, reviews: [] };
  const photo = p.thumb ?? live?.thumb;
  return (
    <article className="stay-card" onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <button type="button" className="pick-open" onClick={onOpen} aria-label={`${p.name}: details`} />
      <div className="stay-photo">
        {photo && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
        ) : (
          <span className="pick-photo-fallback display">{p.name.slice(0, 1)}</span>
        )}
        {(chosen || label) && <span className="stay-badge">{chosen ? "Your hotel" : label}</span>}
        <SaveButton saved={saved} onSave={onSave} name={p.name} overlay />
      </div>
      <div className="stay-text">
        <div className="flex items-start justify-between gap-3">
          <h4 className="display stay-name">{p.name}</h4>
          <RatingLine rating={shownRating} />
        </div>
        <div className="stay-meta">{[sub, p.district].filter(Boolean).join(" · ")}</div>
        {hook(p, 110) && <p className="stay-hook">{hook(p, 110)}</p>}
        {live?.nightly !== undefined ? (
          <div className="stay-price">
            <strong>{fmtUsd(live.nightly)}</strong> a night <span className="price-src">· live, Google Hotels</span>
          </div>
        ) : (
          (price || symbol) && (
            <div className="stay-price">
              {price ? <><strong>{price}</strong> a night{usd && <span className="price-src"> · about {usd}</span>}</> : <><strong className="data">{symbol}</strong> {p.tier ?? ""}</>}
            </div>
          )
        )}
        {onChoose && (
          <button type="button" className={`choose-btn ${chosen ? "on" : ""}`} aria-pressed={chosen} onClick={onChoose} disabled={chosen}>
            {chosen ? "Your hotel" : "Choose as my hotel"}
          </button>
        )}
      </div>
    </article>
  );
}

function PickCard({ place: p, label, rating, saved, onSave, onOpen, onHover }: CardProps & { label: string }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <article className="pick" onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <button type="button" className="pick-open" onClick={onOpen} aria-label={`${p.name}: details`} />
      <div className="pick-photo">
        {p.thumb && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumb} alt="" loading="lazy" onError={() => setImgOk(false)} />
        ) : (
          <span className="pick-photo-fallback display">{p.name.slice(0, 1)}</span>
        )}
        <SaveButton saved={saved} onSave={onSave} name={p.name} overlay />
      </div>
      <div className="flex flex-col gap-1 px-1 pt-3">
        <div className="eyebrow !text-[11px] !text-accent">{label}</div>
        <div className="display text-[20px] leading-snug">{p.name}</div>
        <RatingLine rating={rating} long />
        {hook(p, 110) && <p className="text-[14.5px] leading-relaxed text-ink-2">{hook(p, 110)}</p>}
      </div>
    </article>
  );
}

function PlaceRow({ place: p, sub, rating, saved, onSave, onOpen, onHover }: CardProps & { sub: string }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <li className="place-row" onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-4 py-3.5 text-left" onClick={onOpen}>
        {p.thumb && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumb} alt="" loading="lazy" onError={() => setImgOk(false)} className="place-row-thumb" />
        ) : (
          <span className="place-row-thumb place-row-initial display">{p.name.slice(0, 1)}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="display block truncate text-[18px] leading-snug">{p.name}</span>
          <span className="flex min-w-0 items-center gap-2 text-[14px] text-ink-3">
            <RatingLine rating={rating} />
            <span className="truncate">{[sub, p.tier && p.tier !== sub ? p.tier : null, p.district].filter(Boolean).join(" · ")}</span>
          </span>
        </span>
      </button>
      <SaveButton saved={saved} onSave={onSave} name={p.name} />
    </li>
  );
}

function Review({ review: r }: { review: PlaceRating["reviews"][number] }) {
  const [open, setOpen] = useState(false);
  // "Read more" only when the clamped text is actually cut off.
  const [long, setLong] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const check = () => { if (el.classList.contains("clamped")) setLong(el.scrollHeight > el.clientHeight + 2); };
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <li className="review">
      <div className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
        {r.authorUrl ? (
          <a href={r.authorUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:underline">{r.author}</a>
        ) : (
          <span className="font-medium">{r.author}</span>
        )}
        {r.rating !== undefined && <span className="review-stars" aria-label={`${r.rating} out of 5`}>{"★".repeat(Math.round(r.rating))}<span className="opacity-25">{"★".repeat(5 - Math.round(r.rating))}</span></span>}
        {r.when && <span className="text-ink-3">{r.when}</span>}
      </div>
      <p ref={textRef} className={`review-text ${open ? "" : "clamped"}`}>{r.text}</p>
      {(long || open) && (
        <button type="button" className="review-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </li>
  );
}

const TIMES = ["Morning", "Afternoon", "Evening"] as const;

function stopDays(stop: StopWithDates): string[] {
  const out: string[] = [];
  const d = new Date(`${stop.arrive}T12:00:00Z`);
  const end = new Date(`${stop.depart}T12:00:00Z`);
  while (d < end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out.length ? out : [stop.arrive];
}

/** "Add to my plan": pick a day of this stop and a time of day. */
function AddToPlan({ stop, onAdd }: { stop: StopWithDates; onAdd: (date: string, time: string) => boolean }) {
  const days = stopDays(stop);
  const [date, setDate] = useState(days[0]);
  const [time, setTime] = useState<string>("Morning");
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  return (
    <section className="price-box flex flex-col gap-3" aria-label="Add to my plan">
      <div className="eyebrow">Add to my itinerary</div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="field !h-9 !w-auto !text-[14px]" value={date} onChange={(e) => { setDate(e.target.value); setDone(null); }} aria-label="Day">
          {days.map((d, i) => <option key={d} value={d}>Day {i + 1} in {stop.cityInfo.name} · {fmtShort(d)}</option>)}
        </select>
        <div className="flex gap-1" role="group" aria-label="Time of day">
          {TIMES.map((t) => (
            <button key={t} type="button" aria-pressed={time === t} className={`btn !h-9 !px-3 !text-[13px] ${time === t ? "btn-primary" : ""}`} onClick={() => { setTime(t); setDone(null); }}>{t}</button>
          ))}
        </div>
        <button type="button" className="btn btn-primary !h-9" onClick={() => {
          const ok = onAdd(date, time);
          setErr(!ok);
          setDone(ok ? `${fmtShort(date)}, ${time.toLowerCase()}` : null);
        }}>Add</button>
      </div>
      {done && (
        <p role="status" className="text-[13.5px] text-ink-2">
          Added for {done}. <a href="#concierge" className="underline underline-offset-2">See your day-by-day plan →</a>
        </p>
      )}
      {err && <p role="status" className="text-[13.5px] text-ink-2">That day isn&rsquo;t in your plan. Open the concierge to update the plan for your new dates.</p>}
    </section>
  );
}

function PlaceDetail({ place: p, sub, rating, ratingPending, provider, saved, onSave, onBack, backLabel, links, live, livePricedAt, nights, chosen, chosenSource, onChoose, addToPlan, country }: {
  place: Place; sub: string; rating?: PlaceRating | null; ratingPending: boolean; provider: RatingsProviderInfo | null;
  saved: boolean; onSave: () => void; onBack: () => void; backLabel: string; links: OutLink[];
  live?: LiveHotel; livePricedAt?: string; nights: number; chosen: boolean; chosenSource?: ChosenHotel["source"]; country?: string;
  /** Present for stays when choosing is possible. `manual` is a price the traveller typed in. */
  onChoose?: (manual?: number) => void;
  addToPlan?: { stop: StopWithDates; onAdd: (date: string, time: string) => boolean };
}) {
  const [imgOk, setImgOk] = useState(true);
  const facts: [string, string | undefined][] = [
    ["Price", p.price && approxUsd(priceShort(p.price), country) ? `${p.price} (about ${approxUsd(priceShort(p.price), country)})` : p.price],
    ["Hours", p.hours],
    ["Check-in", p.checkin && p.checkout ? `${p.checkin} · check-out ${p.checkout}` : p.checkin],
    ["Address", p.address],
    ["Getting there", p.directions],
    ["Phone", p.phone],
  ];
  const [primary, ...others] = links;
  const reviews = rating?.reviews.slice(0, 3) ?? [];
  return (
    <article className="flex flex-col gap-6 px-6 pb-12 pt-4">
      <button type="button" className="btn btn-ghost -ml-3 self-start !px-3 !text-[14px]" onClick={onBack}>
        <ArrowIcon size={14} className="rotate-180" /> {backLabel}
      </button>
      {p.thumb && imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.thumb.replace(/\/\d+px-/, "/960px-")} alt="" onError={() => setImgOk(false)} className="detail-photo" />
      )}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow !text-accent">{[sub, p.tier && p.tier !== sub ? p.tier : null].filter(Boolean).join(" · ")}</div>
          <h3 className="display mt-1 text-[32px] leading-tight">{p.name}</h3>
          {(p.alt || p.district) && <p className="mt-1 text-[15px] text-ink-3">{[p.alt, p.district].filter(Boolean).join(" · ")}</p>}
        </div>
        <SaveButton saved={saved} onSave={onSave} name={p.name} />
      </header>

      {ratingPending && <div className="skeleton h-[56px]" aria-label="Loading ratings" />}
      {rating?.rating !== undefined && provider && (
        <section className="rating-summary" aria-label="Rating and reviews">
          <div className="flex items-center gap-4">
            <div className="rating-big display">{rating.rating.toFixed(1)}</div>
            <div className="flex flex-col gap-0.5">
              <span className="review-stars text-[17px]" aria-hidden="true">
                {"★".repeat(Math.round(rating.rating))}<span className="opacity-25">{"★".repeat(5 - Math.round(rating.rating))}</span>
              </span>
              {rating.count !== undefined && <span className="text-[14px] text-ink-2">{fmtCount(rating.count)} {rating.count === 1 ? "rating" : "ratings"}</span>}
            </div>
          </div>
          {reviews.length > 0 && <ul className="flex flex-col">{reviews.map((r, i) => <Review key={`${r.author}-${i}`} review={r} />)}</ul>}
          <p className="text-[12.5px] text-ink-3">
            Rating and reviews from{" "}
            {rating.url ? (
              <a href={rating.url} target="_blank" rel="noopener noreferrer" className="provider-credit">{provider.name}</a>
            ) : (
              <span className="provider-credit">{provider.name}</span>
            )}
            . Reviews are the authors&rsquo; own words.
          </p>
        </section>
      )}

      {onChoose && (
        <section className="price-box" aria-label="Price and my hotel">
          {live?.nightly !== undefined ? (
            <div className="flex flex-col gap-1">
              <div className="price-big display">{fmtUsd(live.nightly)}<span> a night</span></div>
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                {nights > 1 && <>About {fmtUsd(live.nightly * nights)} for {nights} nights. </>}
                Live price from Google Hotels (via SerpApi), checked {fmtChecked(livePricedAt)}. Taxes and fees included where Google shows them. Confirm the price when you book.
              </p>
            </div>
          ) : (
            <p className="text-[14px] text-ink-2">
              No live price for this hotel yet. Use <strong>Show live prices</strong> on the Stay tab, or book to see today&rsquo;s price.
            </p>
          )}
          <ChooseHotel chosen={chosen} chosenSource={chosenSource} hasLivePrice={live?.nightly !== undefined} onChoose={onChoose} />
        </section>
      )}

      {p.description && <p className="text-[16px] leading-relaxed text-ink">{p.description}</p>}
      {addToPlan && <AddToPlan key={p.id} stop={addToPlan.stop} onAdd={addToPlan.onAdd} />}
      {facts.some(([, v]) => v) && (
        <dl className="facts">
          {facts.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap gap-2">
        {primary && (
          <a href={primary.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Open in {primary.label} <ExternalIcon size={12} />
          </a>
        )}
        {others.map((l) => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="btn">
            {l.label} <ExternalIcon size={12} />
          </a>
        ))}
      </div>
    </article>
  );
}
