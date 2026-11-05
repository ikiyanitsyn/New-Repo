"use client";

import { useEffect, useRef } from "react";
import type { Map as MLMap, Marker, GeoJSONSource, StyleSpecification, SkySpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry, LineString, Point } from "geojson";
import type { Leg } from "@/lib/trip";
import type { City } from "@/lib/cities";
import { angleDeg, arcBend, beyond, bentArc, fixAntimeridianPolygon, globeZoomToFit, lineMidpoint, type LngLat } from "@/lib/geo";

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
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function palette() {
  return {
    bg: token("--bg"),
    ocean: token("--ocean"),
    land: token("--land"),
    landActive: token("--land-active"),
    border: token("--border-map"),
    accent: token("--accent"),
    ground: token("--ground"),
  };
}

/**
 * MapLibre's atmosphere is a fixed blue-white scattering glow. Over this
 * palette it reads as a pale haze on the limb and a lighter cap over whichever
 * pole faces the viewer, in both themes, so it is switched off. The sky only
 * shows when the map is pitched; it is set to the page colour for safety.
 */
const sky = (bg: string): SkySpecification => ({ "atmosphere-blend": 0, "sky-color": bg, "horizon-color": bg, "sky-horizon-blend": 0 });

/** The selected leg (or every leg when none is selected) is drawn at full strength; the rest recede. */
const emph = (id: string, selected: string | null) => (selected === null || id === selected ? 1 : 0);

/** Long flights bow slightly to the right of travel, so an outbound and a return over the same corridor separate. */
const legLine = (l: Leg): LngLat[] =>
  bentArc(l.from, l.to, l.distanceKm > 3000 ? 128 : 32, l.mode === "flight" ? arcBend(l.distanceKm) : 0);

function routes(legs: Leg[], selected: string | null): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: legs.map((l) => ({
      type: "Feature",
      properties: { id: l.id, kind: l.mode === "flight" ? "air" : "ground", selected: l.id === selected ? 1 : 0, emph: emph(l.id, selected) },
      geometry: { type: "LineString", coordinates: legLine(l) },
    })),
  };
}

/**
 * One plane per flight, at the middle of its arc. (A `line-center` symbol is
 * placed once per tile piece, so a long arc split across tiles or the
 * antimeridian showed two or three planes stacked along it.)
 */
function planes(legs: Leg[], selected: string | null): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: legs
      .filter((l) => l.mode === "flight")
      .map((l) => {
        const m = lineMidpoint(legLine(l));
        return {
          type: "Feature",
          properties: { id: l.id, selected: l.id === selected ? 1 : 0, emph: emph(l.id, selected), rotate: m.bearing - 90 },
          geometry: { type: "Point", coordinates: [m.lon, m.lat] },
        };
      }),
  };
}

/** Unwrap country rings that jump across the antimeridian (see fixAntimeridianPolygon). */
function fixCountries(fc: FeatureCollection): FeatureCollection {
  const fix = (g: Geometry | null): Geometry | null => {
    if (!g) return g;
    if (g.type === "Polygon") return { ...g, coordinates: fixAntimeridianPolygon(g.coordinates as LngLat[][]) };
    if (g.type === "MultiPolygon") return { ...g, coordinates: g.coordinates.map((p) => fixAntimeridianPolygon(p as LngLat[][])) };
    return g;
  };
  return { ...fc, features: fc.features.map((f, i): Feature => ({ ...f, id: i, geometry: fix(f.geometry) as Geometry })) };
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

function buildStyle(): StyleSpecification {
  const p = palette();
  return {
    version: 8,
    projection: { type: "globe" },
    sky: sky(p.bg),
    sources: {
      countries: { type: "geojson", data: EMPTY, attribution: "Natural Earth" },
      routes: { type: "geojson", data: EMPTY },
      planes: { type: "geojson", data: EMPTY },
    },
    layers: [
      // The background layer paints the whole sphere, including the caps beyond
      // the Mercator limit (±85°), so the poles stay plain ocean.
      { id: "ocean", type: "background", paint: { "background-color": p.ocean } },
      { id: "land", type: "fill", source: "countries", paint: { "fill-color": ["case", ["boolean", ["feature-state", "active"], false], p.landActive, p.land] } },
      { id: "borders", type: "line", source: "countries", paint: { "line-color": p.border, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 5, 1] } },
      {
        id: "routes-ground", type: "line", source: "routes", filter: ["==", ["get", "kind"], "ground"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.ground, "line-width": ["case", ["==", ["get", "selected"], 1], 4, 2.5] },
      },
      {
        id: "routes-air", type: "line", source: "routes", filter: ["==", ["get", "kind"], "air"],
        layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "emph"] },
        paint: {
          "line-color": p.accent,
          "line-width": ["case", ["==", ["get", "selected"], 1], 2.6, 1.5],
          "line-opacity": ["case", ["==", ["get", "emph"], 1], 1, 0.38],
          "line-dasharray": [2, 1.5],
        },
      },
      {
        // A small plane at the middle of each flight, pointing along the route.
        id: "planes", type: "symbol", source: "planes",
        layout: {
          "icon-image": "plane",
          "icon-size": ["case", ["==", ["get", "selected"], 1], 0.62, 0.46],
          "icon-rotate": ["get", "rotate"],
          "icon-rotation-alignment": "map",
          // Facing the viewer, so a plane near the globe's edge isn't squashed flat.
          "icon-pitch-alignment": "viewport",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "symbol-sort-key": ["get", "emph"],
        },
        paint: { "icon-opacity": ["case", ["==", ["get", "emph"], 1], 1, 0.45] },
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
  map.setPaintProperty("land", "fill-color", ["case", ["boolean", ["feature-state", "active"], false], p.landActive, p.land]);
  map.setPaintProperty("borders", "line-color", p.border);
  map.setPaintProperty("routes-ground", "line-color", p.ground);
  map.setPaintProperty("routes-air", "line-color", p.accent);
  map.setSky(sky(p.bg));
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
  const spreadDeg = Math.max(...places.map((p) => angleDeg(p, { lat: center[1], lon: center[0] })));
  const el = map.getContainer();
  const pad = panelPadding(el);
  const visiblePx = Math.min(el.clientWidth - pad.left - pad.right, el.clientHeight - pad.top - pad.bottom);
  // The farthest place sits 24% (one region, so its surroundings show) to 44%
  // (a long-haul leg, so the globe fills the gap) of the gap from the centre.
  // No lower clamp: near the poles the Mercator zoom for a whole-globe view
  // is well below 0 (MapLibre limits it itself).
  const share = 0.2 + 0.24 * Math.min(1, spreadDeg / 60);
  const zoom = Math.min(6, globeZoomToFit(spreadDeg, visiblePx * share, center[1]));
  map.easeTo({ center, zoom, padding: pad, duration: prefersReducedMotion() ? 0 : duration, essential: true });
}

/**
 * The free gap between the floating panels, measured from the panels
 * themselves so it stays right at every breakpoint. On narrow screens the
 * panels sit below the globe and don't overlap it.
 */
function panelPadding(el: HTMLElement) {
  const pad = { top: 56, bottom: 56, left: 32, right: 32 };
  const g = el.getBoundingClientRect();
  const panels = el.parentElement?.querySelectorAll<HTMLElement>(".stage-panels > .panel") ?? [];
  for (const panel of panels) {
    const r = panel.getBoundingClientRect();
    const overlapsY = r.top < g.bottom - 40 && r.bottom > g.top + 40;
    if (!overlapsY || r.width === 0 || r.width > g.width * 0.6) continue;
    if (r.left + r.width / 2 < g.left + g.width / 2) pad.left = Math.max(pad.left, r.right - g.left + 24);
    else pad.right = Math.max(pad.right, g.right - r.left + 24);
  }
  return pad;
}

interface Placed {
  marker: Marker;
  city: City;
  inner: HTMLElement;
  label: HTMLElement;
}

/**
 * Fade places away as they turn towards the globe's edge, and take them out
 * completely (including from clicks and the accessibility tree) once they are
 * round the back. Without this MapLibre leaves occluded markers at 20% opacity,
 * which is how "New York" showed through the North Pole.
 */
function updateVisibility(map: MLMap, placed: Placed[], LngLatCtor: typeof import("maplibre-gl").LngLat) {
  const c = map.getCenter();
  const center = { lat: c.lat, lon: c.lng };
  for (const p of placed) {
    const hidden = map.transform.isLocationOccluded(new LngLatCtor(p.city.lon, p.city.lat));
    const near = beyond(center, p.city, 9);
    const limb = !hidden && map.transform.isLocationOccluded(new LngLatCtor(near.lon, near.lat));
    const state = hidden ? "hidden" : limb ? "limb" : "front";
    if (p.inner.dataset.side === state) continue;
    p.inner.dataset.side = state;
    p.inner.style.opacity = hidden ? "0" : limb ? "0.45" : "1";
    p.inner.style.visibility = hidden ? "hidden" : "visible";
    p.label.style.opacity = state === "front" ? "1" : "0";
  }
}

export default function Globe({ home, stops, legs, selectedLegId, onSelectLeg, onOpenStop }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const placed = useRef<Placed[]>([]);
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
      map.on("move", () => updateVisibility(map, placed.current, maplibregl.LngLat));

      map.on("load", async () => {
        ready.current = true;
        try {
          const [{ feature }, topo] = await Promise.all([
            import("topojson-client"),
            fetch("/geo/countries-50m.json").then((r) => r.json()),
          ]);
          const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
          (map.getSource("countries") as GeoJSONSource).setData(fixCountries(fc));
        } catch {
          // The globe still works without country shapes.
        }
        sync(map, maplibregl, true);
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

  function sync(map: MLMap, ml: typeof import("maplibre-gl"), fit: boolean) {
    const { home, stops, legs, selectedLegId } = latest.current;
    (map.getSource("routes") as GeoJSONSource | undefined)?.setData(routes(legs, selectedLegId));
    (map.getSource("planes") as GeoJSONSource | undefined)?.setData(planes(legs, selectedLegId));

    placed.current.forEach((p) => p.marker.remove());
    placed.current = [];
    const place = (city: City, label: string, cls: string, stopId?: string) => {
      // MapLibre sets opacity on the marker element itself, so the fading is
      // done on the button inside it.
      const wrap = document.createElement("div");
      const el = document.createElement("button");
      el.type = "button";
      el.className = `city-marker ${cls}`;
      el.style.transition = "opacity 200ms ease, visibility 0s";
      el.setAttribute("aria-label", stopId ? `Explore ${city.name}` : city.name);
      if (stopId) el.addEventListener("click", (ev) => { ev.stopPropagation(); onOpenRef.current(stopId); });
      el.title = city.name;
      el.innerHTML = `<span class="dot">${label}</span><span class="label" style="transition:opacity 200ms ease">${city.name}</span>`;
      wrap.appendChild(el);
      const off = cls === "home" ? -5 : -9;
      const marker = new ml.Marker({ element: wrap, anchor: "left", offset: [off, 0], opacityWhenCovered: "0" }).setLngLat([city.lon, city.lat]).addTo(map);
      placed.current.push({ marker, city, inner: el, label: el.querySelector<HTMLElement>(".label")! });
    };
    place(home, "", "home");
    stops.forEach((s) => place(s.city, s.label, "", s.id));
    updateVisibility(map, placed.current, ml.LngLat);

    if (fit && stops.length) frame(map, stops.map((s) => s.city), 2400);
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
    import("maplibre-gl").then((ml) => sync(map, ml.default, fit));
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
