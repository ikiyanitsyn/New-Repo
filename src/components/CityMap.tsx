"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker, StyleSpecification } from "maplibre-gl";
import type { City } from "@/lib/cities";
import type { Place, PlaceCategory } from "@/lib/places/types";

/**
 * Street map for one city, with a pin per guide listing.
 * Tiles: OpenFreeMap (free, no key, OpenStreetMap data). In dark mode the
 * light "positron" style is inverted with a CSS filter. If tiles can't be
 * reached, the map falls back to plain country outlines and still shows pins.
 */

const STREET_STYLE = "https://tiles.openfreemap.org/styles/positron";

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
  onSelect: (id: string) => void;
}

export default function CityMap({ city, places, activeId, hoverId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [dark, setDark] = useState(false);
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
        style: STREET_STYLE,
        center: [city.lon, city.lat],
        zoom: 11.5,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
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

  // Pins for the current list.
  const placeKey = places.map((p) => p.id).join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let alive = true;
    import("maplibre-gl").then(({ default: ml }) => {
      if (!alive) return;
      markers.current.forEach((m) => m.remove());
      markers.current.clear();
      const mapped = places.filter((p) => p.lat !== undefined && p.lon !== undefined);
      mapped.forEach((p) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "place-pin";
        el.style.setProperty("--pin", `var(${PIN_TOKEN[p.category]})`);
        el.setAttribute("aria-label", p.name);
        el.title = p.name;
        el.addEventListener("click", (e) => { e.stopPropagation(); onSelectRef.current(p.id); });
        markers.current.set(p.id, new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lon!, p.lat!]).addTo(map));
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
      <div ref={container} className={`city-map ${dark && !offline ? "invert-tiles" : ""}`} role="region" aria-label={`Map of ${city.name}`} />
      {offline && <span className="chip chip-muted city-map-note">Street map unavailable. Pins still show.</span>}
    </div>
  );
}
