import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCity } from "../cities";
import { hotelBookingUrl, parseTypedPrice, toChosenHotel } from "../hotels/choose";
import { fmtChecked, fmtUsd, nightlyLine, pinPriceLabel } from "../hotels/format";
import { livePlace, matchHotels } from "../hotels/match";
import { hotelsUrl, mapHotelsResponse, type SerpHotelsResponse } from "../hotels/serpapi";
import type { Place } from "../places/types";
import { consumeSerpapi, refundSerpapi, resetSerpapiQuota, serpapiQuota } from "../serpapiQuota";
import fixture from "./fixtures/serpapi-hotels.json";

const beijing = getCity("BJS");
const hotels = mapHotelsResponse(fixture as unknown as SerpHotelsResponse);

describe("SerpApi Google Hotels mapping", () => {
  it("maps price, rating, coordinates, stars and photo", () => {
    const h = hotels[0];
    expect(h).toMatchObject({ name: "Park Hyatt Beijing", nightly: 355, total: 1065, rating: 4.6, reviews: 3120, stars: 5, lat: 39.9087, lon: 116.4585 });
    expect(h.thumb).toBe("https://lh3.googleusercontent.com/a=s287");
    expect(h.link).toContain("hyatt.com");
  });
  it("falls back to the display price, rounds, and uses the plain thumbnail", () => {
    expect(hotels[1]).toMatchObject({ name: "The Opposite House", nightly: 280, thumb: "https://encrypted-tbn0.gstatic.com/images?q=tbn:x" });
    expect(hotels[2].nightly).toBe(96);
  });
  it("keeps hotels with no price, drops rentals, duplicates and nameless entries", () => {
    expect(hotels.map((h) => h.name)).toEqual(["Park Hyatt Beijing", "The Opposite House", "Hutong Courtyard Inn", "Sold Out Hotel"]);
    expect(hotels[3].nightly).toBeUndefined();
  });
  it("builds the request with dates, guests and USD", () => {
    const u = new URL(hotelsUrl({ city: "BJS", checkin: "2026-11-20", checkout: "2026-11-23", adults: 2 }, beijing, "KEY"));
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      engine: "google_hotels", check_in_date: "2026-11-20", check_out_date: "2026-11-23", adults: "2", currency: "USD", api_key: "KEY",
    });
    expect(u.searchParams.get("q")).toBe("Hotels in Beijing, China");
  });
});

const guide: Place[] = [
  { id: "g1", category: "sleep", name: "Park Hyatt Beijing", lat: 39.9089, lon: 116.4583 },
  { id: "g2", category: "sleep", name: "Opposite House", lat: 39.9347, lon: 116.4476 },
  { id: "g3", category: "sleep", name: "Far Park Hyatt", lat: 31.2, lon: 121.4 },
  { id: "g4", category: "sleep", name: "Quiet Garden Guesthouse", lat: 39.95, lon: 116.39 },
];

describe("matching guide stays to live hotels", () => {
  const m = matchHotels(guide, hotels, beijing);
  it("pairs by name and nearby coordinates", () => {
    expect(m.byPlaceId.g1.name).toBe("Park Hyatt Beijing");
    expect(m.byPlaceId.g2.name).toBe("The Opposite House");
  });
  it("does not pair a similar name that is in another city, or a place with no live twin", () => {
    expect(m.byPlaceId.g3).toBeUndefined();
    expect(m.byPlaceId.g4).toBeUndefined();
  });
  it("lists priced hotels the guide doesn't have, and uses each hotel once", () => {
    expect(m.unmatched.map((h) => h.name)).toEqual(["Hutong Courtyard Inn"]);
  });
  it("makes guide-style places for them", () => {
    const p = livePlace(m.unmatched[0], 2);
    expect(p).toMatchObject({ id: "live:2", category: "sleep", name: "Hutong Courtyard Inn", lat: 39.9381 });
  });
});

describe("price formatting", () => {
  it("formats dollars and pin labels", () => {
    expect(fmtUsd(142)).toBe("$142");
    expect(fmtUsd(1153.4)).toBe("$1,153");
    expect(pinPriceLabel(142)).toBe("$142");
    expect(pinPriceLabel(0)).toBeUndefined();
    expect(pinPriceLabel(undefined)).toBeUndefined();
  });
  it("says it per night, with the stay total for several nights", () => {
    expect(nightlyLine(142, 1)).toBe("$142 a night");
    expect(nightlyLine(142, 3)).toBe("$142 a night, about $426 for 3 nights");
  });
  it("says when the price was checked", () => {
    const now = new Date(2026, 10, 8, 18, 0);
    expect(fmtChecked(new Date(2026, 10, 8, 15, 42).toISOString(), now)).toMatch(/^today 3:42/);
    expect(fmtChecked(new Date(2026, 10, 7, 9, 5).toISOString(), now)).toMatch(/^yesterday 9:05/);
    expect(fmtChecked(new Date(2026, 9, 30, 9, 5).toISOString(), now)).toBe("Oct 30");
    expect(fmtChecked(undefined, now)).toBe("");
  });
});

describe("choosing a hotel", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const url = "https://www.booking.com/x";
  it("saves the live price with its source, time, link and coordinates", () => {
    expect(toChosenHotel({ name: "Park Hyatt Beijing", lat: 1, lon: 2, live: hotels[0], livePricedAt: "2026-11-08T10:00:00Z", bookingUrl: url, now })).toEqual({
      name: "Park Hyatt Beijing", nightly: 355, source: "google_hotels", pricedAt: "2026-11-08T10:00:00Z", bookingUrl: url, lat: 1, lon: 2,
    });
  });
  it("takes coordinates from the live result when the guide has none", () => {
    const h = toChosenHotel({ name: "Hutong Courtyard Inn", live: hotels[2], livePricedAt: "2026-11-08T10:00:00Z" });
    expect([h.lat, h.lon]).toEqual([39.9381, 116.4021]);
  });
  it("a guide-only hotel has no price", () => {
    const h = toChosenHotel({ name: "Quiet Garden Guesthouse", lat: 39.95, lon: 116.39, bookingUrl: url, now });
    expect(h).toEqual({ name: "Quiet Garden Guesthouse", source: "guide", bookingUrl: url, lat: 39.95, lon: 116.39 });
    expect(h.nightly).toBeUndefined();
  });
  it("a typed price is saved as manual, and a live price wins over it", () => {
    expect(toChosenHotel({ name: "A", manualNightly: 120, now })).toMatchObject({ nightly: 120, source: "manual", pricedAt: now.toISOString() });
    expect(toChosenHotel({ name: "A", manualNightly: 120, live: hotels[0] })).toMatchObject({ nightly: 355, source: "google_hotels" });
    expect(toChosenHotel({ name: "A", manualNightly: -5 })).toMatchObject({ source: "guide" });
  });
  it("reads typed prices", () => {
    expect(parseTypedPrice("$1,200.50")).toBe(1200.5);
    expect(parseTypedPrice("abc")).toBeUndefined();
    expect(parseTypedPrice("0")).toBeUndefined();
  });
  it("links to Booking.com with the stop's dates", () => {
    const u = hotelBookingUrl("Park Hyatt Beijing", beijing, "2026-11-20", "2026-11-23", 2);
    expect(u).toContain("booking.com/searchresults.html");
    expect(u).toContain("checkin=2026-11-20");
    expect(u).toContain("group_adults=2");
  });
});

describe("SerpApi monthly counter", () => {
  beforeEach(() => { resetSerpapiQuota(); vi.stubEnv("SERPAPI_MONTHLY_LIMIT", "3"); });
  afterEach(() => vi.unstubAllEnvs());
  it("counts up to the limit and then refuses without counting", () => {
    expect([consumeSerpapi(), consumeSerpapi(), consumeSerpapi(), consumeSerpapi()]).toEqual([true, true, true, false]);
    expect(serpapiQuota()).toEqual({ used: 3, limit: 3 });
  });
  it("refunds a search, never below zero", () => {
    refundSerpapi();
    expect(serpapiQuota().used).toBe(0);
    consumeSerpapi();
    refundSerpapi();
    expect(serpapiQuota().used).toBe(0);
  });
  it("starts over in a new month", () => {
    consumeSerpapi(new Date("2026-11-30T12:00:00Z"));
    expect(serpapiQuota(new Date("2026-11-30T13:00:00Z")).used).toBe(1);
    expect(serpapiQuota(new Date("2026-12-01T00:30:00Z")).used).toBe(0);
  });
  it("defaults to 200", () => {
    vi.stubEnv("SERPAPI_MONTHLY_LIMIT", "");
    expect(serpapiQuota().limit).toBe(200);
  });
});

describe("live hotels route logic", () => {
  const q = { city: "BJS", checkin: "2026-11-20", checkout: "2026-11-23", adults: 2 };
  const ok = () => vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })) as unknown as typeof fetch;
  beforeEach(async () => {
    resetSerpapiQuota();
    (await import("../hotels/live")).resetHotelsCache();
    vi.stubEnv("SERPAPI_MONTHLY_LIMIT", "2");
    vi.stubEnv("SERPAPI_KEY", "KEY");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("fetches once, then serves 12 hours from cache without spending a search", async () => {
    const { liveHotels, HOTELS_CACHE_MS } = await import("../hotels/live");
    const fetchImpl = ok();
    let t = 1_000_000;
    const a = await liveHotels(q, { fetchImpl, now: () => t });
    t += HOTELS_CACHE_MS - 1000;
    const b = await liveHotels(q, { fetchImpl, now: () => t });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(b.fetchedAt).toBe(a.fetchedAt);
    expect(serpapiQuota().used).toBe(1);
    expect(a.hotels).toHaveLength(4);
    t += 2000;
    await liveHotels(q, { fetchImpl, now: () => t });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("shares the count with flights and stops at the limit", async () => {
    const { liveHotels } = await import("../hotels/live");
    consumeSerpapi(); // a flight search
    await liveHotels(q, { fetchImpl: ok() });
    await expect(liveHotels({ ...q, adults: 3 }, { fetchImpl: ok() })).rejects.toMatchObject({ code: "quota", status: 429 });
    expect(serpapiQuota().used).toBe(2);
  });
  it("needs a key", async () => {
    vi.stubEnv("SERPAPI_KEY", "");
    const { liveHotels } = await import("../hotels/live");
    await expect(liveHotels(q, { fetchImpl: ok() })).rejects.toMatchObject({ code: "no_key" });
    expect(serpapiQuota().used).toBe(0);
  });
  it("gives the search back when SerpApi fails", async () => {
    const { liveHotels } = await import("../hotels/live");
    const bad = vi.fn(async () => new Response(JSON.stringify({ error: "Invalid API key." }), { status: 401 })) as unknown as typeof fetch;
    await expect(liveHotels(q, { fetchImpl: bad })).rejects.toMatchObject({ code: "upstream", message: "Invalid API key." });
    expect(serpapiQuota().used).toBe(0);
  });
  it("checks the request", async () => {
    const { parseHotelsQuery } = await import("../hotels/live");
    const p = (s: string) => parseHotelsQuery(new URLSearchParams(s), new Date("2026-11-08T00:00:00Z"));
    expect(p("city=BJS&checkin=2026-11-20&checkout=2026-11-23&adults=2")).toEqual(q);
    expect(() => p("city=XXX&checkin=2026-11-20&checkout=2026-11-23")).toThrow("Unknown city");
    expect(() => p("city=BJS&checkin=2026-11-23&checkout=2026-11-20")).toThrow("after check-in");
    expect(() => p("city=BJS&checkin=2026-10-01&checkout=2026-10-03")).toThrow("past");
    expect(() => p("city=BJS&checkin=nope&checkout=2026-11-23")).toThrow("Dates");
    expect(() => p("city=BJS&checkin=2026-11-20&checkout=2026-11-23&adults=0")).toThrow("Guests");
  });
});
