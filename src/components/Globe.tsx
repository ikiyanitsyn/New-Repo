"use client";

import { useEffect, useRef } from "react";
import type { Map as MLMap, Marker, GeoJSONSource, StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, LineString } from "geojson";
import type { Leg } from "@/lib/trip";
import type { City } from "@/lib/cities";
import { distanceKm, greatCircle, type LngLat } from "@/lib/geo";

export interface GlobeStop {
  id: string;
  city: City;
  label: string; // e.g. "1"
}

interface Props {
  home: City;
  stops: GlobeStop[];
  legs: Leg[];
  selectedLegId: string | null;
  onSelectLeg: (id: string) => void;
  onOpenStop: (stopId: string) => void;
}

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function palette() {
  return {
    bg: token("--bg"),
    ocean: token("--ocean"),
    land: token("--land"),
    landActive: token("--land-active"),
    border: token("--border-map"),
    graticule: token("--graticule"),
    accent: token("--accent"),
    ground: token("--ground"),
  };
}

function graticule(): FeatureCollection<LineString> {
  const features: FeatureCollection<LineString>["features"] = [];
  for (let lon = -180; lon < 180; lon += 20) {
    const coords: LngLat[] = [];
    for (let lat = -80; lat <= 80; lat += 4) coords.push([lon, lat]);
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    const coords: LngLat[] = [];
    for (let lon = -180; lon <= 180; lon += 4) coords.push([lon, lat]);
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
  }
  return { type: "FeatureCollection", features };
}

function routes(legs: Leg[], selected: string | null): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: legs.map((l) => ({
      type: "Feature",
      properties: { id: l.id, kind: l.mode === "flight" ? "air" : "ground", selected: l.id === selected ? 1 : 0 },
      geometry: { type: "LineString", coordinates: greatCircle(l.from, l.to, l.distanceKm > 3000 ? 128 : 32) },
    })),
  };
}

function buildStyle(): StyleSpecification {
  const p = palette();
  return {
    version: 8,
    projection: { type: "globe" },
    sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 5, 0.2, 7, 0] },
    sources: {
      graticule: { type: "geojson", data: graticule() },
      countries: { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: "Natural Earth" },
      routes: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": p.ocean } },
      { id: "graticule", type: "line", source: "graticule", paint: { "line-color": p.graticule, "line-width": 0.8 } },
      { id: "land", type: "fill", source: "countries", paint: { "fill-color": ["case", ["boolean", ["feature-state", "active"], false], p.landActive, p.land] } },
      { id: "borders", type: "line", source: "countries", paint: { "line-color": p.border, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 5, 1] } },
      {
        id: "routes-ground", type: "line", source: "routes", filter: ["==", ["get", "kind"], "ground"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.ground, "line-width": ["case", ["==", ["get", "selected"], 1], 4, 2.5] },
      },
      {
        id: "routes-air", type: "line", source: "routes", filter: ["==", ["get", "kind"], "air"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": p.accent,
          "line-width": ["case", ["==", ["get", "selected"], 1], 3, 1.6],
          "line-dasharray": [2, 1.5],
        },
      },
      {
        // A small plane at the middle of each flight, pointing at the destination.
        id: "planes", type: "symbol", source: "routes", filter: ["==", ["get", "kind"], "air"],
        layout: {
          "symbol-placement": "line-center",
          "icon-image": "plane",
          "icon-size": ["case", ["==", ["get", "selected"], 1], 0.62, 0.48],
          "icon-rotation-alignment": "map",
          "icon-keep-upright": false,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      },
      { id: "routes-hit", type: "line", source: "routes", paint: { "line-color": "#000", "line-opacity": 0, "line-width": 16 } },
    ],
  };
}

/** Plane silhouette pointing east (+x), filled with the accent and outlined in the ocean colour. */
function planeImage(): ImageData {
  const p = palette();
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const k = size / 24;
  const pts = [
    [22, 12], [20, 10.9], [14, 10.9], [9.2, 3], [7.2, 3], [10, 10.9], [5.2, 10.9], [3.2, 8.4], [1.8, 8.4], [2.7, 12],
    [1.8, 15.6], [3.2, 15.6], [5.2, 13.1], [10, 13.1], [7.2, 21], [9.2, 21], [14, 13.1], [20, 13.1],
  ];
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = p.ocean;
  ctx.stroke();
  ctx.fillStyle = p.accent;
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

function applyPalette(map: MLMap) {
  if (map.hasImage("plane")) map.updateImage("plane", planeImage());
  const p = palette();
  map.setPaintProperty("ocean", "background-color", p.ocean);
  map.setPaintProperty("graticule", "line-color", p.graticule);
  map.setPaintProperty("land", "fill-color", ["case", ["boolean", ["feature-state", "active"], false], p.landActive, p.land]);
  map.setPaintProperty("borders", "line-color", p.border);
  map.setPaintProperty("routes-ground", "line-color", p.ground);
  map.setPaintProperty("routes-air", "line-color", p.accent);
}

/**
 * Frame a set of places on the globe. Fitting mercator bounds misbehaves for
 * long-haul arcs, so this centres on the spherical midpoint and picks a zoom
 * from the widest angular spread, shifted into the gap between the panels.
 */
function frame(map: MLMap, places: { lat: number; lon: number }[], duration: number) {
  const v = places.reduce(
    (a, p) => {
      const φ = (p.lat * Math.PI) / 180, λ = (p.lon * Math.PI) / 180;
      return [a[0] + Math.cos(φ) * Math.cos(λ), a[1] + Math.cos(φ) * Math.sin(λ), a[2] + Math.sin(φ)];
    },
    [0, 0, 0],
  );
  const center: [number, number] = [
    (Math.atan2(v[1], v[0]) * 180) / Math.PI,
    (Math.atan2(v[2], Math.hypot(v[0], v[1])) * 180) / Math.PI,
  ];
  const spreadKm = Math.max(...places.map((p) => distanceKm(p, { lat: center[1], lon: center[0] })), 150);
  const el = map.getContainer();
  const pad = panelPadding(el);
  const visiblePx = Math.min(el.clientWidth - pad.left - pad.right, el.clientHeight - pad.top - pad.bottom);
  // At zoom z the globe is ~512·2^z px around; aim for the spread to fill ~45% of the visible gap.
  const circumferencePx = (visiblePx * 0.32 * 40075) / (2 * spreadKm);
  const zoom = Math.max(0.6, Math.min(6, Math.log2(circumferencePx / 512)));
  map.easeTo({ center, zoom, padding: pad, duration, essential: true });
}

function panelPadding(el: HTMLElement) {
  const w = el.clientWidth;
  if (w < 860) return { top: 48, bottom: 48, left: 40, right: 40 };
  return { top: 80, bottom: 80, left: Math.min(440, w * 0.32), right: Math.min(500, w * 0.36) };
}

export default function Globe({ home, stops, legs, selectedLegId, onSelectLeg, onOpenStop }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const ready = useRef(false);
  const onSelectRef = useRef(onSelectLeg);
  onSelectRef.current = onSelectLeg;
  const onOpenRef = useRef(onOpenStop);
  onOpenRef.current = onOpenStop;
  const latest = useRef({ home, stops, legs, selectedLegId });
  latest.current = { home, stops, legs, selectedLegId };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !container.current) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const map = new maplibregl.Map({
        container: container.current,
        style: buildStyle(),
        center: [-30, 30],
        zoom: 1.2,
        attributionControl: { compact: true },
        renderWorldCopies: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      const markZoom = () => container.current?.setAttribute("data-zoomed", String(map.getZoom() >= 3.2));
      markZoom();
      map.on("zoomend", markZoom);

      map.on("load", async () => {
        ready.current = true;
        try {
          const [{ feature }, topo] = await Promise.all([
            import("topojson-client"),
            fetch("/geo/countries-50m.json").then((r) => r.json()),
          ]);
          const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
          fc.features.forEach((f, i) => (f.id = i));
          (map.getSource("countries") as GeoJSONSource).setData(fc);
        } catch {
          // The globe still works without country shapes.
        }
        sync(map, maplibregl.Marker, true, reduced);
      });

      map.on("styleimagemissing", (e) => {
        if (e.id === "plane" && !map.hasImage("plane")) map.addImage("plane", planeImage(), { pixelRatio: 2 });
      });

      map.on("click", "routes-hit", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectRef.current(String(id));
      });
      map.on("mouseenter", "routes-hit", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "routes-hit", () => (map.getCanvas().style.cursor = ""));

      const onTheme = () => requestAnimationFrame(() => ready.current && applyPalette(map));
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      window.addEventListener("in:themechange", onTheme);
      mq.addEventListener("change", onTheme);
      cleanup = () => {
        window.removeEventListener("in:themechange", onTheme);
        mq.removeEventListener("change", onTheme);
        map.remove();
      };
    })();
    return () => {
      cancelled = true;
      ready.current = false;
      cleanup();
      mapRef.current = null;
    };
  }, []);

  function sync(map: MLMap, MarkerCtor: typeof Marker, fit: boolean, reduced = false) {
    const { home, stops, legs, selectedLegId } = latest.current;
    (map.getSource("routes") as GeoJSONSource | undefined)?.setData(routes(legs, selectedLegId));

    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const place = (city: City, label: string, cls: string, stopId?: string) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `city-marker ${cls}`;
      el.setAttribute("aria-label", stopId ? `Explore ${city.name}` : city.name);
      if (stopId) el.addEventListener("click", (ev) => { ev.stopPropagation(); onOpenRef.current(stopId); });
      el.title = city.name;
      el.innerHTML = `<span class="dot">${label}</span><span class="label">${city.name}</span>`;
      const off = cls === "home" ? -5 : -9;
      markers.current.push(new MarkerCtor({ element: el, anchor: "left", offset: [off, 0] }).setLngLat([city.lon, city.lat]).addTo(map));
    };
    place(home, "", "home");
    stops.forEach((s) => place(s.city, s.label, "", s.id));

    if (fit && stops.length) frame(map, stops.map((s) => s.city), reduced ? 0 : 2400);
  }

  // Keep routes and markers in step with the trip.
  const stopKey = stops.map((s) => s.city.code).join(",") + "|" + home.code;
  const legKey = legs.map((l) => `${l.id}:${l.mode}`).join(",");
  const lastStopKey = useRef(stopKey);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const fit = lastStopKey.current !== stopKey;
    lastStopKey.current = stopKey;
    import("maplibre-gl").then(({ default: ml }) => sync(map, ml.Marker, fit));
  }, [stopKey, legKey, selectedLegId]);

  // Fly to the selected leg.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current || !selectedLegId) return;
    const leg = legs.find((l) => l.id === selectedLegId);
    if (!leg) return;
    frame(map, [leg.from, leg.to], 1400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLegId]);

  return <div ref={container} className="globe" role="region" aria-label="Route globe. Drag to rotate, scroll to zoom." />;
}
