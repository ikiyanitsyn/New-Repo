import type { StyleSpecification } from "maplibre-gl";

/**
 * Map styles for the city guide.
 *
 * STREET: OpenFreeMap "positron" (free, no key, OpenStreetMap data).
 *
 * SATELLITE, chosen after checking the options:
 *  - EOX Sentinel-2 cloudless (CHOSEN, no key). Free, served over plain tile
 *    URLs, licence CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/,
 *    layer notes: https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml and
 *    https://cloudless.eox.at). Non-commercial use with attribution is allowed,
 *    which fits this personal, unpaid trip planner. If the app ever earns
 *    money, buy a licence from EOX or switch to MapTiler (below).
 *    Limit: 10 m pixels, so detail stops at about zoom 14 (city blocks look
 *    soft, buildings are not sharp). Roads and place names come from the EOX
 *    "overlay" layer (OpenStreetMap data, rendering by EOX), drawn on top.
 *  - MapTiler satellite (OPTIONAL upgrade). Sharp, labelled imagery. The free
 *    plan needs an account key and is for non-commercial use, with MapTiler
 *    and OpenStreetMap credits. Set NEXT_PUBLIC_MAPTILER_KEY to use it.
 *    Not tested here: no key in the build sandbox.
 *  - Not used: Esri World Imagery (the public tile URL has no free,
 *    key-less licence for other apps; it belongs to the ArcGIS developer
 *    plans), USGS imagery (US only).
 */

export const STREET_STYLE = "https://tiles.openfreemap.org/styles/positron";

export type MapMode = "street" | "satellite";
export interface MapPrefs { mode: MapMode; labels: boolean }
export const DEFAULT_PREFS: MapPrefs = { mode: "street", labels: true };

const PREFS_KEY = "in:mapstyle:v1";

export function readMapPrefs(): MapPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (raw && (raw.mode === "street" || raw.mode === "satellite")) return { mode: raw.mode, labels: raw.labels !== false };
  } catch { /* private window or blocked storage: use the default */ }
  return DEFAULT_PREFS;
}

export function writeMapPrefs(p: MapPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* not saved; fine */ }
}

const EOX = "https://tiles.maps.eox.at/wmts/1.0.0";

export const EOX_ATTRIBUTION =
  '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless - https://s2maps.eu</a> by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2024; <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>)';
export const EOX_LABELS_ATTRIBUTION =
  'Overlay: Data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, Rendering &copy; <a href="https://eox.at" target="_blank" rel="noopener">EOX</a>';

/** Sentinel-2 pixels are 10 m: beyond this zoom tiles are stretched, not sharper. */
export const EOX_MAX_ZOOM = 14;

export function eoxSatelliteStyle(labels: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {
      imagery: {
        type: "raster",
        tiles: [`${EOX}/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg`],
        tileSize: 256,
        maxzoom: EOX_MAX_ZOOM,
        attribution: EOX_ATTRIBUTION,
      },
      ...(labels
        ? {
            overlay: {
              type: "raster" as const,
              tiles: [`${EOX}/overlay_3857/default/g/{z}/{y}/{x}.png`],
              tileSize: 256,
              maxzoom: EOX_MAX_ZOOM - 1,
              attribution: EOX_LABELS_ATTRIBUTION,
            },
          }
        : {}),
    },
    layers: [
      { id: "imagery", type: "raster", source: "imagery" },
      ...(labels ? [{ id: "overlay", type: "raster" as const, source: "overlay" }] : []),
    ],
  };
}

const maptilerKey = () => process.env.NEXT_PUBLIC_MAPTILER_KEY || "";

/** The style to load: a style URL (street, MapTiler) or an inline style (EOX). */
export function mapStyleFor(prefs: MapPrefs): string | StyleSpecification {
  if (prefs.mode === "street") return STREET_STYLE;
  const key = maptilerKey();
  if (key) return `https://api.maptiler.com/maps/${prefs.labels ? "hybrid" : "satellite"}/style.json?key=${encodeURIComponent(key)}`;
  return eoxSatelliteStyle(prefs.labels);
}

/** Highest zoom the imagery has real detail for. */
export const satelliteMaxZoom = () => (maptilerKey() ? 20 : EOX_MAX_ZOOM + 1);
