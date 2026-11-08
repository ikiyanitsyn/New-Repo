"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker, StyleSpecification } from "maplibre-gl";
import type { City } from "@/lib/cities";
import { DEFAULT_PREFS, mapStyleFor, readMapPrefs, satelliteMaxZoom, writeMapPrefs, type MapPrefs } from "@/lib/places/mapStyles";
import type { Place, PlaceCategory } from "@/lib/places/types";

/**
 * Map for one city, with a pin per guide listing and a Street / Satellite switch.
 * Street tiles: OpenFreeMap (free, no key, OpenStreetMap data). In dark mode the
 * light "positron" style is inverted with a CSS filter. Satellite: see
 * src/lib/places/mapStyles.ts for the source, licence and attribution.
 * If tiles can't be reached, the map falls back to plain country outlines and
 * still shows pins.
 */

const PIN_TOKEN: Record<PlaceCategory, string> = {
  sleep: "--pin-sleep",
  see: "--pin-see",
  do: "--pin-do",
  eat: "--pin-eat",
  drink: "--pin-drink",
  buy: "--pin-buy",
};

function fallbackStyle(): StyleSpecification {
  const t = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return {
    version: 8,
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": t("--land") } }],
  };
}

const isDark = () => getComputedStyle(document.documentElement).colorScheme.includes("dark");

interface Props {
  city: City;
  places: Place[];
  activeId: string | null;
  hoverId: string | null;
  /** Text for stay pins (rating or price). Stays get listing-style pills; other places keep coloured drop pins. */
  pinLabels?: Record<string, string>;
  onSelect: (id: string) => void;
  /** Pixels at the left of the map covered by the sliding list panel; the map centres on what's left. */
  leftPad?: number;
  /** The traveller's chosen hotel: always on the map, with its own pin. */
  myHotel?: { name: string; lat: number; lon: number } | null;
  /** The guide place that is the chosen hotel, so it isn't drawn twice. */
  myHotelPlaceId?: string | null;
}

const BED_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-8v6"/><circle cx="6.5" cy="11.5" r="1.5"/></svg>';

/** The pill's content: its label, or a small bed when there's no rating or price to show. */
function fillStayPin(el: HTMLElement, name: string, label: string | undefined) {
  const inner = el.firstElementChild as HTMLElement;
  el.classList.toggle("priced", !!label); // pills with a price sit above the plain bed pills
  if (label) inner.textContent = label;
  else inner.innerHTML = BED_SVG;
  el.setAttribute("aria-label", label ? `${name}, ${label}` : name);
}

const HOME_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>';

export default function CityMap({ city, places, activeId, hoverId, pinLabels = {}, onSelect, leftPad = 0, myHotel = null, myHotelPlaceId = null }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [dark, setDark] = useState(false);
  const [prefs, setPrefs] = useState<MapPrefs>(() => (typeof window === "undefined" ? DEFAULT_PREFS : readMapPrefs()));
  const prefsRef = useRef(prefs);
  const padRef = useRef(leftPad);
  useEffect(() => { prefsRef.current = prefs; padRef.current = leftPad; });
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; });

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !container.current) return;
      let loaded = false;
      const map = new maplibregl.Map({
        container: container.current,
        style: mapStyleFor(prefsRef.current),
        center: [city.lon, city.lat],
        zoom: 11.5,
        maxZoom: prefsRef.current.mode === "satellite" ? satelliteMaxZoom() : 19,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.setPadding({ left: padRef.current, top: 0, right: 0, bottom: 0 });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      // The map can be hidden and shown (phone list/map toggle), so keep it sized to its box.
      const ro = new ResizeObserver(() => map.resize());
      ro.observe(container.current);
      map.on("load", () => { loaded = true; setReady(true); });
      map.on("error", () => {
        if (loaded) return; // a single missing tile later on is fine
        loaded = true;
        setOffline(true);
        map.setStyle(fallbackStyle());
        map.once("styledata", () => setReady(true));
      });
      const onTheme = () => setDark(isDark());
      onTheme();
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      window.addEventListener("in:themechange", onTheme);
      mq.addEventListener("change", onTheme);
      cleanup = () => {
        ro.disconnect();
        window.removeEventListener("in:themechange", onTheme);
        mq.removeEventListener("change", onTheme);
        markers.current.forEach((m) => m.remove());
        markers.current.clear();
        map.remove();
      };
    })();
    return () => {
      cancelled = true;
      cleanup();
      mapRef.current = null;
      setReady(false);
    };
  }, [city]);

  // Street / Satellite: swap the style in place; the pins are DOM markers and stay put.
  const appliedPrefs = useRef(prefs);
  useEffect(() => {
    const map = mapRef.current;
    const was = appliedPrefs.current;
    if (!map || !ready || (was.mode === prefs.mode && was.labels === prefs.labels)) return;
    appliedPrefs.current = prefs;
    map.setMaxZoom(prefs.mode === "satellite" ? satelliteMaxZoom() : 19);
    map.setStyle(mapStyleFor(prefs));
  }, [prefs, ready]);

  const choosePrefs = (next: MapPrefs) => { setPrefs(next); writeMapPrefs(next); };

  // The list panel slides over the left of the map: keep the centre of what's visible.
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready && map.getPadding().left !== leftPad) map.easeTo({ padding: { left: leftPad, top: 0, right: 0, bottom: 0 }, duration: 380 });
  }, [leftPad, ready]);

  // Pins for the current list.
  const placeKey = places.map((p) => p.id).join(",") + `|${myHotelPlaceId ?? ""}`;
  const labelsRef = useRef(pinLabels);
  useEffect(() => { labelsRef.current = pinLabels; });
  const labelKey = places.map((p) => pinLabels[p.id] ?? "").join("|");

  // Labels can arrive after the pins (ratings load lazily): update them in place, without refitting the map.
  useEffect(() => {
    for (const p of places) {
      const el = markers.current.get(p.id)?.getElement();
      if (el?.classList.contains("stay-pin")) fillStayPin(el, p.name, pinLabels[p.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelKey]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let alive = true;
    import("maplibre-gl").then(({ default: ml }) => {
      if (!alive) return;
      markers.current.forEach((m) => m.remove());
      markers.current.clear();
      const mapped = places.filter((p) => p.lat !== undefined && p.lon !== undefined);
      mapped.filter((p) => p.id !== myHotelPlaceId).forEach((p) => {
        const el = document.createElement("button");
        el.type = "button";
        const stay = p.category === "sleep";
        if (stay) {
          // MapLibre positions the button with an inline transform, so the pill inside does the scaling.
          el.className = "stay-pin";
          el.appendChild(document.createElement("span")).className = "stay-pin-pill";
          fillStayPin(el, p.name, labelsRef.current[p.id]);
        } else {
          el.className = "place-pin";
          el.style.setProperty("--pin", `var(${PIN_TOKEN[p.category]})`);
          el.setAttribute("aria-label", p.name);
        }
        el.title = p.name;
        el.addEventListener("click", (e) => { e.stopPropagation(); onSelectRef.current(p.id); });
        markers.current.set(p.id, new ml.Marker({ element: el, anchor: stay ? "center" : "bottom" }).setLngLat([p.lon!, p.lat!]).addTo(map));
      });
      if (mapped.length > 1) {
        const lons = mapped.map((p) => p.lon!), lats = mapped.map((p) => p.lat!);
        map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 60, maxZoom: 15, duration: 600 });
      } else if (mapped.length === 1) {
        map.easeTo({ center: [mapped[0].lon!, mapped[0].lat!], zoom: 14, duration: 600 });
      } else {
        map.easeTo({ center: [city.lon, city.lat], zoom: 11.5, duration: 600 });
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey, ready]);

  // The chosen hotel: its own pin, always shown.
  const hotelMarker = useRef<Marker | null>(null);
  const hotelKey = myHotel ? `${myHotel.name}|${myHotel.lat}|${myHotel.lon}` : "";
  useEffect(() => {
    const map = mapRef.current;
    hotelMarker.current?.remove();
    hotelMarker.current = null;
    if (!map || !ready || !myHotel) return;
    let alive = true;
    import("maplibre-gl").then(({ default: ml }) => {
      if (!alive) return;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "my-hotel-pin";
      el.title = `My hotel: ${myHotel.name}`;
      el.setAttribute("aria-label", `My hotel: ${myHotel.name}`);
      el.style.zIndex = "4";
      el.innerHTML = `<span class="my-hotel-pin-pill">${HOME_SVG}<span>My hotel</span></span>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (myHotelPlaceId) onSelectRef.current(myHotelPlaceId);
        else map.easeTo({ center: [myHotel.lon, myHotel.lat], zoom: Math.max(map.getZoom(), 14.5), duration: 600 });
      });
      hotelMarker.current = new ml.Marker({ element: el, anchor: "center" }).setLngLat([myHotel.lon, myHotel.lat]).addTo(map);
    });
    return () => { alive = false; hotelMarker.current?.remove(); hotelMarker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelKey, ready, myHotelPlaceId]);

  // Highlight and fly to the chosen place.
  useEffect(() => {
    markers.current.forEach((m, id) => {
      const el = m.getElement();
      el.classList.toggle("active", id === activeId);
      el.classList.toggle("hover", id === hoverId);
      el.style.zIndex = id === activeId ? "3" : id === hoverId ? "2" : "";
    });
  }, [activeId, hoverId, placeKey, ready]);

  useEffect(() => {
    const p = places.find((x) => x.id === activeId);
    if (p?.lat !== undefined && mapRef.current) mapRef.current.easeTo({ center: [p.lon!, p.lat], zoom: Math.max(mapRef.current.getZoom(), 14.5), duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return (
    <div className="city-map-wrap">
      <div ref={container} className={`city-map ${dark && !offline && prefs.mode === "street" ? "invert-tiles" : ""}`} role="region" aria-label={`Map of ${city.name}`} />
      <div className="map-style-switch" role="group" aria-label="Map style">
        <button type="button" aria-pressed={prefs.mode === "street"} onClick={() => choosePrefs({ ...prefs, mode: "street" })}>Street</button>
        <button type="button" aria-pressed={prefs.mode === "satellite"} onClick={() => choosePrefs({ ...prefs, mode: "satellite" })}>Satellite</button>
        {prefs.mode === "satellite" && (
          <button type="button" className="labels-toggle" aria-pressed={prefs.labels} onClick={() => choosePrefs({ ...prefs, labels: !prefs.labels })}>
            Labels
          </button>
        )}
      </div>
      {offline && <span className="chip chip-muted city-map-note">Street map unavailable. Pins still show.</span>}
    </div>
  );
}
