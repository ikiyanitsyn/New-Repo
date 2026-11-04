"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtShort } from "@/lib/format";
import { placeLinks, staySearchLinks } from "@/lib/places/links";
import { picksFor, subcategoryOf, subcategoryOrder } from "@/lib/places/subcategory";
import { CATEGORY_LABEL, type Place, type PlaceCategory, type PlacesResult } from "@/lib/places/types";
import { placeKey, type SavedPlace, type StopWithDates } from "@/lib/trip";
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

/** First sentence of a description, for one calm line under a name. */
function hook(p: Place, max = 120): string | undefined {
  if (!p.description) return undefined;
  const first = p.description.split(/(?<=[.!?])\s/)[0];
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}

export function CityExplorer({ stops, stopId, adults, saved, onToggleSave, onNavigate, onClose }: Props) {
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

  const savedKeys = useMemo(() => new Set(saved.map((s) => s.key)), [saved]);
  const all = useMemo(() => data?.places ?? [], [data]);
  const withSub = useMemo(() => all.map((p) => ({ place: p, sub: subcategoryOf(p) })), [all]);

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
    () => (tab !== "saved" && sub === "all" && visible.length > 5 ? picksFor(visible, tab) : []),
    [visible, tab, sub],
  );
  const pickIds = new Set(picks.map((p) => p.place.id));
  const rest = visible.filter((p) => !pickIds.has(p.id));
  const detail = all.find((p) => p.id === detailId) ?? null;
  const tabCount = (t: Tab) => (t === "saved" ? saved.length : all.filter((p) => p.category === t).length);
  const tabs = TABS.filter((t) => t.id !== "buy" || tabCount("buy") > 0);

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

  const stays = staySearchLinks(city, stop.arrive, stop.depart, adults);
  const role = index === 0 ? "Arriving" : index === stops.length - 1 ? "Final stop" : `Stop ${index + 1} of ${stops.length}`;

  return (
    <section className="explorer" data-view={phoneView} aria-label={`Explore ${city.name}`}>
      <div className="explorer-guide" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
              place={detail}
              sub={subcategoryOf(detail)}
              saved={savedKeys.has(placeKey(detail.name))}
              onSave={() => toggleSave(detail)}
              onBack={() => setDetailId(null)}
              backLabel={tab === "saved" ? "Saved" : CATEGORY_LABEL[tab]}
              links={placeLinks(detail, city)}
            />
          ) : (
            <div className="flex flex-col gap-5 px-6 pb-8 pt-5">
              <h3 className="display text-[24px] leading-tight">
                {tab === "saved" ? `Your saved places in ${city.name}` : HEADLINE[tab](city.name)}
              </h3>

              {tab === "sleep" && (
                <div className="stay-cta">
                  <div>
                    <div className="text-[14px] font-medium">Check prices for your dates</div>
                    <div className="text-[13px] text-ink-2">{fmtShort(stop.arrive)} – {fmtShort(stop.depart)} · {adults} {adults === 1 ? "guest" : "guests"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={stays[0].url} target="_blank" rel="noopener noreferrer" className="btn btn-primary !h-9">
                      {stays[0].label} <ExternalIcon size={12} />
                    </a>
                    {stays.slice(1).map((l) => (
                      <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="btn !h-9">
                        {l.label} <ExternalIcon size={12} />
                      </a>
                    ))}
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
                  <div className="eyebrow">Our picks</div>
                  <div className="picks">
                    {picks.map(({ place, label }) => (
                      <PickCard
                        key={place.id}
                        place={place}
                        label={label}
                        saved={savedKeys.has(placeKey(place.name))}
                        onSave={() => toggleSave(place)}
                        onOpen={() => open(place.id)}
                        onHover={(on) => setHoverId(on ? place.id : null)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {rest.length > 0 && (
                <section aria-label="All places" className="flex flex-col gap-1">
                  {picks.length > 0 && <div className="eyebrow pb-1">More to explore · {rest.length}</div>}
                  <ul className="flex flex-col">
                    {rest.slice(0, shown).map((p) => (
                      <PlaceRow
                        key={p.id}
                        place={p}
                        sub={tab === "saved" ? CATEGORY_LABEL[p.category] : subcategoryOf(p)}
                        saved={savedKeys.has(placeKey(p.name))}
                        onSave={() => toggleSave(p)}
                        onOpen={() => open(p.id)}
                        onHover={(on) => setHoverId(on ? p.id : null)}
                      />
                    ))}
                  </ul>
                  {rest.length > shown && (
                    <button type="button" className="btn mt-3 self-start" onClick={() => setShown((n) => n + LIST_STEP * 2)}>
                      Show {Math.min(LIST_STEP * 2, rest.length - shown)} more
                    </button>
                  )}
                </section>
              )}

              {data && !data.error && (
                <p className="pt-2 text-[12px] text-ink-3">
                  From the free travel guide{" "}
                  <a href={data.articleUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Wikivoyage</a>
                  {" "}(text CC BY-SA) and Wikimedia photos. Confirm opening times with the venue.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <CityMap
        city={city}
        places={detail ? [detail] : visible}
        activeId={detailId}
        hoverId={hoverId}
        onSelect={open}
      />

      <button type="button" className="map-toggle" onClick={() => setPhoneView((v) => (v === "list" ? "map" : "list"))}>
        {phoneView === "list" ? <><MapIcon size={16} /> Map</> : <><ListIcon size={16} /> List</>}
      </button>
    </section>
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

function PickCard({ place: p, label, saved, onSave, onOpen, onHover }: { place: Place; label: string; saved: boolean; onSave: () => void; onOpen: () => void; onHover: (on: boolean) => void }) {
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
        <div className="eyebrow !text-[10.5px] !text-accent">{label}</div>
        <div className="display text-[20px] leading-snug">{p.name}</div>
        {hook(p, 110) && <p className="text-[14px] leading-relaxed text-ink-2">{hook(p, 110)}</p>}
      </div>
    </article>
  );
}

function PlaceRow({ place: p, sub, saved, onSave, onOpen, onHover }: { place: Place; sub: string; saved: boolean; onSave: () => void; onOpen: () => void; onHover: (on: boolean) => void }) {
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
          <span className="display block truncate text-[17px] leading-snug">{p.name}</span>
          <span className="block truncate text-[13px] text-ink-3">{[sub, p.tier && p.tier !== sub ? p.tier : null, p.district].filter(Boolean).join(" · ")}</span>
        </span>
      </button>
      <SaveButton saved={saved} onSave={onSave} name={p.name} />
    </li>
  );
}

function PlaceDetail({ place: p, sub, saved, onSave, onBack, backLabel, links }: { place: Place; sub: string; saved: boolean; onSave: () => void; onBack: () => void; backLabel: string; links: { label: string; url: string }[] }) {
  const [imgOk, setImgOk] = useState(true);
  const facts: [string, string | undefined][] = [
    ["Price", p.price],
    ["Hours", p.hours],
    ["Check-in", p.checkin && p.checkout ? `${p.checkin} · check-out ${p.checkout}` : p.checkin],
    ["Address", p.address],
    ["Getting there", p.directions],
    ["Phone", p.phone],
  ];
  const [primary, ...others] = links;
  return (
    <article className="flex flex-col gap-5 px-6 pb-10 pt-4">
      <button type="button" className="btn btn-ghost -ml-3 self-start !px-3 !text-[13.5px]" onClick={onBack}>
        <ArrowIcon size={14} className="rotate-180" /> {backLabel}
      </button>
      {p.thumb && imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.thumb.replace(/\/\d+px-/, "/960px-")} alt="" onError={() => setImgOk(false)} className="detail-photo" />
      )}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow !text-accent">{[sub, p.tier && p.tier !== sub ? p.tier : null].filter(Boolean).join(" · ")}</div>
          <h3 className="display mt-1 text-[30px] leading-tight">{p.name}</h3>
          {(p.alt || p.district) && <p className="mt-1 text-[14px] text-ink-3">{[p.alt, p.district].filter(Boolean).join(" · ")}</p>}
        </div>
        <SaveButton saved={saved} onSave={onSave} name={p.name} />
      </header>
      {p.description && <p className="text-[15.5px] leading-relaxed text-ink">{p.description}</p>}
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
