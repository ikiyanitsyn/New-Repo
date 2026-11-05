import { describe, expect, it } from "vitest";
import {
  angleDeg, arcBend, bearingDeg, bentArc, beyond, densify, distanceKm, fixAntimeridianPolygon, lineMidpoint,
  globeZoomToFit, POLAR_LIMIT, unwrapLongitudes, type LngLat,
} from "@/lib/geo";

describe("globeZoomToFit", () => {
  // MapLibre: globe radius = 512·2^z / (2π·cos(centre latitude)).
  const radiusAt = (z: number, lat: number) => (512 * 2 ** z) / (2 * Math.PI * Math.cos((lat * Math.PI) / 180));
  it("puts the farthest place at the requested distance from the centre", () => {
    const z = globeZoomToFit(30, 200, 0);
    expect(radiusAt(z, 0) * Math.sin(Math.PI / 6)).toBeCloseTo(200, 6);
  });
  it("accounts for MapLibre scaling the globe up away from the equator", () => {
    expect(radiusAt(globeZoomToFit(30, 200, 60), 60)).toBeCloseTo(radiusAt(globeZoomToFit(30, 200, 0), 0), 6);
  });
  it("zooms out for long-haul spreads and in for a single region", () => {
    expect(globeZoomToFit(50, 200, 40)).toBeLessThan(globeZoomToFit(10, 200, 40));
  });
});

const NYC = { lat: 40.71, lon: -74.01 };
const BJS = { lat: 39.9, lon: 116.4 };
const HKG = { lat: 22.32, lon: 114.17 };
const PVG = { lat: 31.23, lon: 121.47 };

const maxStep = (l: LngLat[]) => Math.max(...l.slice(1).map((p, i) => Math.abs(p[0] - l[i][0])));

describe("unwrapLongitudes", () => {
  it("removes jumps across the antimeridian", () => {
    expect(unwrapLongitudes([[170, 0], [179, 1], [-179, 2], [-170, 3]])).toEqual([[170, 0], [179, 1], [181, 2], [190, 3]]);
  });
  it("can start near a given longitude", () => {
    expect(unwrapLongitudes([[-170, 0]], 175)[0][0]).toBe(190);
  });
});

describe("fixAntimeridianPolygon", () => {
  it("unwraps a ring that crosses 180° (the Russia band artifact)", () => {
    const ring: LngLat[] = [[170, 60], [180, 60], [-180, 60], [-170, 60], [-170, 70], [-180, 70], [180, 70], [170, 70], [170, 60]];
    const [out] = fixAntimeridianPolygon([ring]);
    expect(maxStep(out)).toBeLessThanOrEqual(180);
    expect(Math.min(...out.map((p) => p[0]))).toBe(170);
    expect(Math.max(...out.map((p) => p[0]))).toBe(190);
  });
  it("brings holes alongside their outer ring", () => {
    const outer: LngLat[] = [[170, 60], [-170, 60], [-170, 70], [170, 70], [170, 60]];
    const hole: LngLat[] = [[-175, 64], [-172, 64], [-172, 66], [-175, 64]];
    const [, h] = fixAntimeridianPolygon([outer, hole]);
    expect(h[0][0]).toBe(185);
  });
  it("leaves ordinary and pole-enclosing rings alone", () => {
    const plain: LngLat[] = [[0, 0], [10, 0], [10, 10], [0, 0]];
    expect(fixAntimeridianPolygon([plain])[0]).toBe(plain);
    const antarctic: LngLat[] = [[-180, -90], [-180, -80], [0, -70], [179, -80], [-180, -90]];
    expect(fixAntimeridianPolygon([antarctic])[0]).toBe(antarctic);
  });
});

describe("bentArc", () => {
  it("starts and ends at the two places", () => {
    const l = bentArc(BJS, HKG, 32, 2);
    expect(l[0][0]).toBeCloseTo(BJS.lon, 6);
    expect(l[0][1]).toBeCloseTo(BJS.lat, 6);
    const end = l[l.length - 1];
    expect(((end[0] - HKG.lon) % 360 + 360) % 360).toBeCloseTo(0, 6);
    expect(end[1]).toBeCloseTo(HKG.lat, 6);
  });

  it("bows to the right of travel, so opposite directions separate", () => {
    const there = lineMidpoint(bentArc(BJS, PVG, 64, 3));
    const back = lineMidpoint(bentArc(PVG, BJS, 64, 3));
    // ~6° apart at the middle (3° each side) rather than on top of each other.
    expect(angleDeg(there, back)).toBeGreaterThan(5);
  });

  it("keeps polar routes inside the Mercator limit, without long east–west steps", () => {
    for (const [a, b] of [[NYC, BJS], [HKG, NYC], [BJS, NYC]]) {
      const l = bentArc(a, b, 128, arcBend(distanceKm(a, b)));
      expect(Math.max(...l.map((p) => Math.abs(p[1])))).toBeLessThanOrEqual(POLAR_LIMIT);
      expect(maxStep(l)).toBeLessThan(2.5);
    }
  });

  it("separates the default trip's outbound and return over the Arctic", () => {
    const out = lineMidpoint(bentArc(NYC, BJS, 128, arcBend(distanceKm(NYC, BJS))));
    const ret = lineMidpoint(bentArc(HKG, NYC, 128, arcBend(distanceKm(HKG, NYC))));
    expect(angleDeg(out, ret)).toBeGreaterThan(2);
  });
});

describe("arcBend", () => {
  it("leaves short hops straight and caps long ones", () => {
    expect(arcBend(1200)).toBe(0);
    expect(arcBend(11000)).toBeGreaterThan(2);
    expect(arcBend(19000)).toBe(3);
  });
});

describe("densify", () => {
  it("adds points on the great circle where longitude steps are large", () => {
    const l = densify([[0, 80], [40, 80]], 2);
    expect(l.length).toBe(21);
    expect(maxStep(l)).toBeLessThan(2.5);
    // The great circle between two points on 80°N runs north of that parallel.
    expect(l[10][1]).toBeGreaterThan(80);
  });
});

describe("lineMidpoint and bearingDeg", () => {
  it("finds the halfway point and the direction of travel", () => {
    const m = lineMidpoint(densify([[0, 0], [20, 0]], 1));
    expect(m.lon).toBeCloseTo(10, 6);
    expect(m.lat).toBeCloseTo(0, 6);
    expect(m.bearing).toBeCloseTo(90, 3);
  });
  it("wraps the longitude back into [-180, 180)", () => {
    expect(lineMidpoint([[170, 0], [210, 0]]).lon).toBeCloseTo(-170, 6);
  });
  it("gives compass bearings", () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 10, lon: 0 })).toBeCloseTo(0, 6);
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: -10 })).toBeCloseTo(270, 6);
  });
});

describe("beyond", () => {
  it("extends a point further from the centre along the same great circle", () => {
    const c = { lat: 0, lon: 0 };
    const p = beyond(c, { lat: 0, lon: 60 }, 10);
    expect(p.lon).toBeCloseTo(70, 6);
    expect(p.lat).toBeCloseTo(0, 6);
    const q = beyond(c, { lat: 50, lon: 0 }, 5);
    expect(q.lat).toBeCloseTo(55, 6);
  });
  it("returns the point itself at the centre", () => {
    expect(beyond({ lat: 10, lon: 10 }, { lat: 10, lon: 10 }, 5)).toEqual({ lat: 10, lon: 10 });
  });
});

describe("country geometry", () => {
  it("unwraps the real Natural Earth Russia polygon", async () => {
    const { readFileSync } = await import("node:fs");
    const { feature } = await import("topojson-client");
    const topo = JSON.parse(readFileSync(new URL("../../../public/geo/countries-50m.json", import.meta.url), "utf8"));
    const fc = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>;
    const russia = fc.features.find((f) => f.properties?.name === "Russia")!;
    for (const poly of russia.geometry.coordinates) {
      for (const ring of fixAntimeridianPolygon(poly as LngLat[][])) expect(maxStep(ring)).toBeLessThanOrEqual(180);
    }
  });
});
