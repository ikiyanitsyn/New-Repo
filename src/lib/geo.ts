export type LngLat = [number, number];

const R_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const kmToMiles = (km: number) => km * 0.621371;

/**
 * Points along the great circle from a to b, with longitudes unwrapped so
 * consecutive points never jump by more than 180° (keeps lines continuous
 * across the antimeridian).
 */
export function greatCircle(a: { lat: number; lon: number }, b: { lat: number; lon: number }, steps = 96): LngLat[] {
  const φ1 = toRad(a.lat), λ1 = toRad(a.lon), φ2 = toRad(b.lat), λ2 = toRad(b.lon);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return [[a.lon, a.lat]];
  const out: LngLat[] = [];
  let prevLon: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    let lon = toDeg(Math.atan2(y, x));
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    prevLon = lon;
    out.push([lon, lat]);
  }
  return out;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatMiles(km: number): string {
  return `${Math.round(kmToMiles(km)).toLocaleString("en-US")} mi`;
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ---------- Globe helpers ----------

type Vec3 = [number, number, number];

const toVec = (p: { lat: number; lon: number }): Vec3 => {
  const φ = toRad(p.lat), λ = toRad(p.lon);
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
};
const fromVec = ([x, y, z]: Vec3): { lat: number; lon: number } => ({
  lat: toDeg(Math.atan2(z, Math.hypot(x, y))),
  lon: toDeg(Math.atan2(y, x)),
});
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Make a run of longitudes continuous: no step between neighbours exceeds 180°. */
export function unwrapLongitudes(points: LngLat[], startNear?: number): LngLat[] {
  const out: LngLat[] = [];
  let prev: number | null = startNear ?? null;
  for (const [lon0, lat] of points) {
    let lon = lon0;
    if (prev !== null) {
      while (lon - prev > 180) lon -= 360;
      while (lon - prev < -180) lon += 360;
    }
    out.push([lon, lat]);
    prev = lon;
  }
  return out;
}

const jumps = (ring: LngLat[]) => ring.reduce((n, p, i) => (i && Math.abs(p[0] - ring[i - 1][0]) > 180 ? n + 1 : n), 0);

/**
 * Natural Earth splits some shapes (Russia, Fiji) at the antimeridian with a
 * jump from +180 to -180 inside one ring. A renderer treats that jump as an
 * edge across the whole world and fills a band right round the globe. Unwrap
 * such rings so they run continuously past 180°; MapLibre wraps them back.
 * Rings that enclose a pole (an odd number of jumps, e.g. Antarctica) are
 * left as they are.
 */
export function fixAntimeridianPolygon(rings: LngLat[][]): LngLat[][] {
  if (!rings.some((r) => jumps(r) > 0 && jumps(r) % 2 === 0)) return rings;
  const outer = jumps(rings[0]) % 2 === 0 ? unwrapLongitudes(rings[0]) : rings[0];
  const mid = outer.reduce((s, p) => s + p[0], 0) / outer.length;
  return [outer, ...rings.slice(1).map((r) => (jumps(r) % 2 === 0 ? unwrapLongitudes(r, mid) : r))];
}

/**
 * Points from a to b along a great circle bowed sideways by up to `bendDeg`
 * (to the right of the direction of travel, peaking mid-route). An outbound
 * and a return flight between the same regions travel in opposite
 * directions, so they bow apart instead of drawing on top of each other.
 */
export function bentArc(a: { lat: number; lon: number }, b: { lat: number; lon: number }, steps = 96, bendDeg = 0): LngLat[] {
  const base = greatCircle(a, b, steps);
  if (base.length < 3) return base;
  const n = norm(cross(toVec(a), toVec(b)));
  const bend = (deg: number) =>
    unwrapLongitudes(base.map(([lon, lat], i): LngLat => {
      const δ = toRad(deg) * Math.sin((Math.PI * i) / steps);
      const p = toVec({ lat, lon });
      const q = fromVec(norm([
        p[0] * Math.cos(δ) - n[0] * Math.sin(δ),
        p[1] * Math.cos(δ) - n[1] * Math.sin(δ),
        p[2] * Math.cos(δ) - n[2] * Math.sin(δ),
      ]));
      return [q.lon, q.lat];
    }));
  // Prefer the requested bend, then gentler ones, then bending the other way
  // (further each time), until the arc stays clear of the poles.
  const tries = [1, 0.75, 0.5, 0.25, 0, -0.5, -1, -1.5, -2, -3].map((k) => k * (bendDeg || 1));
  if (!bendDeg) tries.unshift(0);
  let line = base;
  for (const t of tries) {
    line = t ? bend(t) : base;
    if (maxAbsLat(line) <= POLAR_LIMIT) break;
  }
  return densify(line);
}

/**
 * MapLibre draws lines in Web Mercator, which stops at ±85.05°: anything
 * further north or south is squashed onto that circle and kinks. Arcs are
 * kept a little inside it.
 */
export const POLAR_LIMIT = 84;
const maxAbsLat = (line: LngLat[]) => line.reduce((m, p) => Math.max(m, Math.abs(p[1])), 0);

/**
 * Add points wherever neighbours are far apart in longitude. Each segment is
 * drawn straight in Mercator, so near a pole a long east–west step bulges
 * along a line of latitude instead of following the arc.
 */
export function densify(line: LngLat[], maxLonStep = 2): LngLat[] {
  const out: LngLat[] = line.length ? [line[0]] : [];
  for (let i = 1; i < line.length; i++) {
    const [p, q] = [line[i - 1], line[i]];
    const k = Math.ceil(Math.abs(q[0] - p[0]) / maxLonStep);
    if (k > 1) {
      const u = toVec({ lon: p[0], lat: p[1] }), v = toVec({ lon: q[0], lat: q[1] });
      const ω = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])));
      for (let j = 1; j < k; j++) {
        const f = j / k;
        const A = ω < 1e-9 ? 1 - f : Math.sin((1 - f) * ω) / Math.sin(ω);
        const B = ω < 1e-9 ? f : Math.sin(f * ω) / Math.sin(ω);
        const m = fromVec([A * u[0] + B * v[0], A * u[1] + B * v[1], A * u[2] + B * v[2]]);
        out.push([m.lon, m.lat]);
      }
    }
    out.push(q);
  }
  return unwrapLongitudes(out);
}

/** How far a long-haul arc should bow: a few degrees, nothing for short hops. */
export const arcBend = (km: number) => (km < 3000 ? 0 : Math.min(3, (km / R_KM) * toDeg(1) * 0.035));

/** Initial compass bearing from a to b, in degrees clockwise from north. */
export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat), Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** The middle point of a line and the bearing of travel there (for a single plane icon). */
export function lineMidpoint(line: LngLat[]): { lon: number; lat: number; bearing: number } {
  const ll = (p: LngLat) => ({ lon: p[0], lat: p[1] });
  const seg = line.slice(1).map((p, i) => distanceKm(ll(line[i]), ll(p)));
  let rest = seg.reduce((s, d) => s + d, 0) / 2;
  let i = 0;
  while (i < seg.length - 1 && rest > seg[i]) rest -= seg[i++];
  if (!seg.length) return { lon: line[0]?.[0] ?? 0, lat: line[0]?.[1] ?? 0, bearing: 0 };
  // Interpolate within segment i (short, so linear in lon/lat is fine).
  const f = seg[i] ? rest / seg[i] : 0;
  const [p, q] = [line[i], line[i + 1]];
  const lon = p[0] + (q[0] - p[0]) * f, lat = p[1] + (q[1] - p[1]) * f;
  return { lon: ((((lon + 180) % 360) + 360) % 360) - 180, lat, bearing: bearingDeg(ll(p), ll(q)) };
}

/** Angular distance between two points on the sphere, in degrees. */
export const angleDeg = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => toDeg(distanceKm(a, b) / R_KM);

/**
 * The point `extraDeg` further from `center` than `p`, on the great circle
 * through both. Used to ask "is this place close to the globe's edge?": if a
 * point a little beyond it is already round the back, it is near the limb.
 */
export function beyond(center: { lat: number; lon: number }, p: { lat: number; lon: number }, extraDeg: number): { lat: number; lon: number } {
  const c = toVec(center), v = toVec(p);
  const d = Math.acos(Math.max(-1, Math.min(1, c[0] * v[0] + c[1] * v[1] + c[2] * v[2])));
  if (d < 1e-6) return { ...p };
  // Unit tangent at the centre pointing towards p.
  const dot = Math.cos(d);
  const t = norm([v[0] - c[0] * dot, v[1] - c[1] * dot, v[2] - c[2] * dot]);
  const θ = d + toRad(extraDeg);
  return fromVec([c[0] * Math.cos(θ) + t[0] * Math.sin(θ), c[1] * Math.cos(θ) + t[1] * Math.sin(θ), c[2] * Math.cos(θ) + t[2] * Math.sin(θ)]);
}

/**
 * The MapLibre globe zoom at which every place up to `maxAngleDeg` from the
 * view centre lands within `fitRadiusPx` of it. MapLibre's globe radius is
 * 512·2^z / (2π·cos(centre latitude)) px, and a place θ from the centre
 * appears about R·sin θ px away (perspective only pulls it closer).
 */
export function globeZoomToFit(maxAngleDeg: number, fitRadiusPx: number, centerLat: number): number {
  const θ = toRad(Math.min(80, Math.max(1.5, maxAngleDeg)));
  const radiusPx = fitRadiusPx / Math.sin(θ);
  return Math.log2((radiusPx * 2 * Math.PI * Math.cos(toRad(Math.min(85, Math.abs(centerLat))))) / 512);
}
