import { describe, expect, it } from "vitest";
import { EOX_ATTRIBUTION, STREET_STYLE, eoxSatelliteStyle, mapStyleFor } from "../places/mapStyles";

describe("map styles", () => {
  it("street is the OpenFreeMap style", () => {
    expect(mapStyleFor({ mode: "street", labels: true })).toBe(STREET_STYLE);
  });
  it("satellite is Sentinel-2 cloudless with the licence credit, and an optional labels overlay", () => {
    const withLabels = eoxSatelliteStyle(true);
    expect(Object.keys(withLabels.sources)).toEqual(["imagery", "overlay"]);
    expect(withLabels.layers.map((l) => l.id)).toEqual(["imagery", "overlay"]);
    const plain = eoxSatelliteStyle(false);
    expect(Object.keys(plain.sources)).toEqual(["imagery"]);
    const src = plain.sources.imagery as { attribution: string; tiles: string[] };
    expect(src.attribution).toBe(EOX_ATTRIBUTION);
    expect(src.attribution).toMatch(/Sentinel-2 cloudless.*EOX IT Services GmbH.*Copernicus Sentinel data/);
    expect(src.tiles[0]).toMatch(/^https:\/\/tiles\.maps\.eox\.at\/.*s2cloudless/);
  });
});
