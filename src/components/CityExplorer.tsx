"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtShort } from "@/lib/format";
import { commonsThumb, placeLinks, staySearchLinks } from "@/lib/places/links";
import { CATEGORY_LABEL, CATEGORY_ORDER, type Place, type PlaceCategory, type PlacesResult } from "@/lib/places/types";
import type { StopWithDates } from "@/lib/trip";
import { ArrowIcon, CloseIcon, ExternalIcon } from "./icons";

const CityMap = dynamic(() => import("./CityMap"), { ssr: false, loading: () => <div className="city-map-wrap" /> });

interface Props {
  stops: StopWithDates[];
  stopId: string;
  adults: number;
  onNavigate: (stopId: string) => void;
  onClose: () => void;
}

type Tier = "all" | NonNullable<Place["tier"]>;

export function CityExplorer({ stops, stopId, adults, onNavigate, onClose }: Props) {
  const index = Math.max(0, stops.findIndex((s) => s.id === stopId));
  const stop = stops[index];
  const city = stop.cityInfo;
  const prev = stops[index - 1];
  const next = stops[index + 1];

  // Which way the content slides in when moving between cities.
  const [seenIndex, setSeenIndex] = useState(index);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  if (index !== seenIndex) {
    setDirection(index > seenIndex ? "next" : "prev");
    setSeenIndex(index);
  }

  const [category, setCategory] = useState<PlaceCategory>("sleep");
  const [tier, setTier] = useState<Tier>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [state, setState] = useState<{ city: string; data?: PlacesResult; error?: string } | null>(null);
  const loading = state?.city !== city.code;
  const data = loading ? null : state?.data ?? null;

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

  const counts = useMemo(() => {
    const c = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, 0])) as Record<PlaceCategory, number>;
    data?.places.forEach((p) => c[p.category]++);
    return c;
  }, [data]);

  const inCategory = useMemo(() => (data?.places ?? []).filter((p) => p.category === category), [data, category]);
  const tiers = useMemo(() => [...new Set(inCategory.map((p) => p.tier).filter(Boolean))] as NonNullable<Place["tier"]>[], [inCategory]);
  const visible = useMemo(() => (tier === "all" ? inCategory : inCategory.filter((p) => p.tier === tier)), [inCategory, tier]);

  const chooseCategory = (c: PlaceCategory) => { setCategory(c); setTier("all"); setActiveId(null); };
  const go = (s?: StopWithDates) => { if (s) { setActiveId(null); setTier("all"); onNavigate(s.id); } };

  // Keyboard: Esc closes; ←/→ move between cities when not typing or on the map.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, select, textarea, .city-map")) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(next);
      else if (e.key === "ArrowLeft") go(prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Swipe left/right on the guide column to move between cities.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) go(dx < 0 ? next : prev);
  };

  const selectFromMap = (id: string) => {
    const p = data?.places.find((x) => x.id === id);
    if (p && p.category !== category) { setCategory(p.category); setTier("all"); }
    setActiveId(id);
    requestAnimationFrame(() => document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const stays = staySearchLinks(city, stop.arrive, stop.depart, adults);

  return (
    <section className="explorer" aria-label={`Explore ${city.name}`}>
      <div className="explorer-guide" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-2.5">
          <button type="button" className="btn btn-ghost !h-8 !px-2.5 !text-[13px]" onClick={onClose}>
            <ArrowIcon size={14} className="rotate-180" /> Route
          </button>
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-ghost !h-8 !px-2.5 !text-[12.5px]" disabled={!prev} onClick={() => go(prev)} aria-label={prev ? `Previous city: ${prev.cityInfo.name}` : "No previous city"}>
              <ArrowIcon size={13} className="rotate-180" /> <span className="hidden sm:inline">{prev?.cityInfo.name ?? ""}</span>
            </button>
            <span className="data text-[11.5px] text-ink-3">{index + 1}/{stops.length}</span>
            <button type="button" className="btn btn-ghost !h-8 !px-2.5 !text-[12.5px]" disabled={!next} onClick={() => go(next)} aria-label={next ? `Next city: ${next.cityInfo.name}` : "No next city"}>
              <span className="hidden sm:inline">{next?.cityInfo.name ?? ""}</span> <ArrowIcon size={13} />
            </button>
            <button type="button" className="btn btn-ghost btn-icon sm:!hidden" onClick={onClose} aria-label="Close city guide"><CloseIcon size={16} /></button>
          </div>
        </div>

        <div key={city.code} className={`explorer-slide-${direction} flex min-h-0 flex-1 flex-col`}>
          <header className="flex flex-col gap-1 px-5 pb-3 pt-4">
            <div className="eyebrow">
              {index === 0 ? "Fly in" : index === stops.length - 1 ? "Fly out" : `Stop ${index + 1}`} · {fmtShort(stop.arrive)} – {fmtShort(stop.depart)} · {stop.nights} {stop.nights === 1 ? "night" : "nights"}
            </div>
            <h2 className="display text-[34px] leading-tight">
              {city.name}
              {city.localName && <span className="ml-2 text-[18px] text-ink-3">{city.localName}</span>}
            </h2>
            <p className="text-[12.5px] text-ink-2">{city.countryName}</p>
          </header>

          <div className="px-5 pb-3">
            <div className="segmented max-w-full overflow-x-auto" role="tablist" aria-label="Kinds of places">
              {CATEGORY_ORDER.filter((c) => c !== "buy" || counts.buy > 0).map((c) => (
                <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => chooseCategory(c)}>
                  {CATEGORY_LABEL[c]}
                  {data && <span className="data ml-1 text-[10.5px] text-ink-3">{counts[c]}</span>}
                </button>
              ))}
            </div>
          </div>

          {category === "sleep" && (
            <div className="mx-5 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2 text-[12.5px]" style={{ background: "var(--accent-soft)" }}>
              <span className="text-ink-2">Prices for {fmtShort(stop.arrive)} – {fmtShort(stop.depart)}:</span>
              {stays.map((l) => (
                <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline-offset-2 hover:underline">
                  {l.label} <ExternalIcon size={11} />
                </a>
              ))}
            </div>
          )}

          {tiers.length > 1 && (
            <div className="flex flex-wrap gap-1.5 px-5 pb-3" role="group" aria-label="Price level">
              {(["all", ...tiers] as Tier[]).map((t) => (
                <button key={t} type="button" aria-pressed={tier === t} onClick={() => setTier(t)}
                  className={`chip ${tier === t ? "chip-accent" : "chip-muted"} cursor-pointer`}>
                  {t === "all" ? "All" : t}
                </button>
              ))}
            </div>
          )}

          <ul className="scroll-y flex min-h-0 flex-1 flex-col gap-2 px-3 pb-4" aria-busy={loading}>
            {loading && Array.from({ length: 6 }).map((_, i) => <li key={i} className="skeleton mx-2 h-[92px]" />)}
            {!loading && (state?.error || data?.error) && (
              <li className="mx-2 rounded-md px-3 py-3 text-[13px]" style={{ background: "var(--surface-sunk)" }}>
                <p className="text-ink">{data?.error ?? state?.error}</p>
                <p className="mt-1 text-ink-2">
                  You can still browse {city.name} on{" "}
                  <a className="underline" href={`https://www.tripadvisor.com/Search?q=${encodeURIComponent(city.name)}`} target="_blank" rel="noopener noreferrer">TripAdvisor</a> or{" "}
                  <a className="underline" href={`https://en.wikivoyage.org/wiki/${encodeURIComponent(city.name)}`} target="_blank" rel="noopener noreferrer">Wikivoyage</a>.
                </p>
              </li>
            )}
            {!loading && data && !data.error && visible.length === 0 && (
              <li className="mx-2 py-6 text-center text-[13.5px] text-ink-2">The guide has no {CATEGORY_LABEL[category].toLowerCase()} listings for {city.name} yet.</li>
            )}
            {visible.map((p) => (
              <PlaceCard
                key={p.id}
                place={p}
                active={p.id === activeId}
                onSelect={() => setActiveId(p.id === activeId ? null : p.id)}
                onHover={(on) => setHoverId(on ? p.id : null)}
                links={placeLinks(p, city)}
              />
            ))}
          </ul>

          {data && !data.error && (
            <footer className="border-t border-line px-5 py-2.5 text-[11.5px] text-ink-3">
              Listings from{" "}
              <a href={data.articleUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Wikivoyage: {data.articleTitle}</a>
              , text CC BY-SA. Check details with the venue before you go.
            </footer>
          )}
        </div>
      </div>

      <CityMap city={city} places={visible} activeId={activeId} hoverId={hoverId} onSelect={selectFromMap} />
    </section>
  );
}

function PlaceCard({ place: p, active, onSelect, onHover, links }: { place: Place; active: boolean; onSelect: () => void; onHover: (on: boolean) => void; links: { label: string; url: string }[] }) {
  const [imgOk, setImgOk] = useState(true);
  const meta = [p.price, p.hours, p.checkin && `Check-in ${p.checkin}`].filter(Boolean).join(" · ");
  return (
    <li
      id={`place-${p.id}`}
      className="mx-1 scroll-mt-2 rounded-lg border transition-colors"
      style={{ borderColor: active ? "var(--accent)" : "var(--line)", background: active ? "var(--accent-soft)" : "var(--surface-solid)" }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <button type="button" onClick={onSelect} aria-expanded={active} className="flex w-full gap-3 px-3.5 pb-2 pt-3 text-left">
        {p.image && imgOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={commonsThumb(p.image, 160)} alt="" loading="lazy" onError={() => setImgOk(false)} className="h-16 w-16 flex-none rounded-md object-cover" style={{ background: "var(--surface-sunk)" }} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="display text-[17px] leading-snug">{p.name}</span>
            {p.tier && <span className="chip chip-muted flex-none">{p.tier}</span>}
          </span>
          {(p.alt || p.district || p.group) && (
            <span className="block truncate text-[12px] text-ink-3">{[p.alt, p.district ?? p.group].filter(Boolean).join(" · ")}</span>
          )}
          {p.description && <span className={`mt-1 block text-[13px] text-ink-2 ${active ? "" : "line-clamp-2"}`}>{p.description}</span>}
          {meta && <span className="data mt-1 block text-[11.5px] text-ink-2">{meta}</span>}
          {p.lat === undefined && <span className="mt-1 block text-[11.5px] text-ink-3">Not on the map</span>}
        </span>
      </button>
      {active && (
        <div className="flex flex-col gap-1.5 px-3.5 pb-3 text-[12.5px]">
          {p.address && <p className="text-ink-2">{p.address}{p.directions ? ` · ${p.directions}` : ""}</p>}
          {p.phone && <p className="data text-ink-2">{p.phone}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {links.map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-2 underline decoration-[var(--line-strong)] underline-offset-2 hover:text-ink">
                {l.label} <ExternalIcon size={11} />
              </a>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
