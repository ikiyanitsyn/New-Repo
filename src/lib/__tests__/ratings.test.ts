import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCity } from "../cities";
import { priceShort, stayPinLabel } from "../places/display";
import { staySearchLinks } from "../places/links";
import { findPlaceByName, matchCandidate, nameSimilarity } from "../places/match";
import { picksFor } from "../places/subcategory";
import type { Place, PlaceRating, PlacesResult } from "../places/types";
import fixture from "./fixtures/google-text-search.json";

// The guide is mocked: ratings.ts reads listings through cityPlaces().
const guide: Place[] = [
  { id: "m1", category: "eat", name: "Da Dong", lat: 39.9327, lon: 116.4336, tier: "Splurge" },
  { id: "m2", category: "eat", name: "Noodle Loft" },
  { id: "m3", category: "see", name: "Lama Temple", lat: 39.9473, lon: 116.4177 },
];
vi.mock("../places/wikivoyage", () => ({
  cityPlaces: async (city: string): Promise<PlacesResult> => ({
    city, source: "wikivoyage", articleTitle: "Beijing", articleUrl: "https://en.wikivoyage.org/wiki/Beijing", places: guide, fetchedAt: "2026-11-01T00:00:00Z",
  }),
}));

const { googleProvider, mapGooglePlace, pickGoogleMatch, placeRatings, ratingsProvider, resetRatingsState, GOOGLE_FIELD_MASK, MAX_LOOKUPS_PER_REQUEST } = await import("../places/ratings");
type GooglePlace = Parameters<typeof mapGooglePlace>[0];
const places = (fixture as unknown as { places: GooglePlace[] }).places;
const beijing = getCity("BJS");

describe("Google Places mapping", () => {
  it("maps rating, count, price level, link and up to three non-empty reviews", () => {
    const r = mapGooglePlace(places[1]);
    expect(r.rating).toBe(4.4);
    expect(r.count).toBe(2310);
    expect(r.priceLevel).toBe(3);
    expect(r.url).toBe("https://maps.google.com/?cid=2");
    expect(r.reviews.map((x) => [x.author, x.text, x.when])).toEqual([
      ["Test Reviewer A", "Crisp duck carved at the table. Book ahead for dinner.", "2 months ago"],
      ["Test Reviewer C", "服务很好", "3 months ago"],
      ["Google user", "Good but pricey.", "4 months ago"],
    ]);
    expect(r.reviews[0].authorUrl).toBe("https://www.google.com/maps/contrib/1");
  });

  it("copes with a place that has no rating or reviews", () => {
    expect(mapGooglePlace({ id: "x" })).toEqual({ rating: undefined, count: undefined, priceLevel: undefined, url: undefined, reviews: [] });
  });

  it("picks the same place by name and distance, not a nearby namesake or a far branch", () => {
    expect(pickGoogleMatch(guide[0], places, beijing)?.id).toBe("ChIJ-fixture-dadong");
    expect(pickGoogleMatch(guide[2], places, beijing)).toBeUndefined();
  });
});

describe("name and coordinate matching", () => {
  const centre = { lat: 39.9042, lon: 116.4074 };
  it("scores names", () => {
    expect(nameSimilarity("The Peninsula Beijing", "Peninsula", ["Beijing"])).toBe(0.9);
    expect(nameSimilarity("Café de la Paix", "Cafe de la Paix")).toBe(1);
    expect(nameSimilarity("Jing An Temple", "Jing'an Temple")).toBe(1);
    expect(nameSimilarity("Grand Hyatt", "Hyatt Regency")).toBeLessThan(0.6);
    expect(nameSimilarity("全聚德", "全聚德(前门店)")).toBe(0.9);
  });

  it("accepts within about 300 m, and a little more for an identical name", () => {
    const place = { name: "Grand Hotel", lat: 39.9, lon: 116.4 };
    expect(matchCandidate(place, [{ name: "Grand Hotel Beijing", lat: 39.9020, lon: 116.4 }], { cityCentre: centre, ignore: ["Beijing"] })).toBeTruthy(); // ~220 m
    expect(matchCandidate(place, [{ name: "The Grand Hotel", lat: 39.9060, lon: 116.4 }], { cityCentre: centre })).toBeTruthy(); // ~670 m, same name
    expect(matchCandidate(place, [{ name: "Grand Hotel", lat: 39.92, lon: 116.4 }], { cityCentre: centre })).toBeUndefined(); // ~2.2 km
    expect(matchCandidate(place, [{ name: "Grand Peak Hostel", lat: 39.9001, lon: 116.4 }], { cityCentre: centre })).toBeUndefined();
  });

  it("matches by name within the city when the guide has no pin, and uses the local-script name", () => {
    expect(matchCandidate({ name: "Noodle Loft" }, [{ name: "Noodle Loft", lat: 39.95, lon: 116.45 }], { cityCentre: centre })).toBeTruthy();
    expect(matchCandidate({ name: "Noodle Loft" }, [{ name: "Noodle Loft", lat: 31.23, lon: 121.47 }], { cityCentre: centre })).toBeUndefined();
    expect(matchCandidate({ name: "Quanjude", alt: "全聚德" }, [{ name: "全聚德", lat: 39.9, lon: 116.4 }], { cityCentre: centre })).toBeTruthy();
  });
});

describe("placeRatings: caching and limits", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    resetRatingsState();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(fixture), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is off without a key", async () => {
    expect(ratingsProvider({})).toBeNull();
    expect(await placeRatings("BJS", ["m1"], null)).toEqual({ provider: null, ratings: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks Google with a field mask and location bias, then answers from memory", async () => {
    const provider = googleProvider("test-key");
    const first = await placeRatings("BJS", ["m1", "m3", "nope"], provider);
    expect(first.provider).toEqual({ id: "google", name: "Google Maps", showOnMap: false });
    expect(first.ratings.m1?.rating).toBe(4.4);
    expect(first.ratings.m3).toBeNull(); // looked up, no confident match
    expect("nope" in first.ratings).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("test-key");
    expect(headers["X-Goog-FieldMask"]).toBe(GOOGLE_FIELD_MASK);
    const body = JSON.parse(init.body as string);
    expect(body.textQuery).toBe("Da Dong, Beijing");
    expect(body.locationBias.circle).toEqual({ center: { latitude: 39.9327, longitude: 116.4336 }, radius: 500 });

    const again = await placeRatings("BJS", ["m1", "m3"], provider);
    expect(again.ratings).toEqual(first.ratings);
    expect(fetchMock).toHaveBeenCalledTimes(2); // both from memory, including the "no match"
  });

  it("stops at the daily safety limit", async () => {
    vi.stubEnv("GOOGLE_PLACES_DAILY_LIMIT", "1");
    const r = await placeRatings("BJS", ["m1", "m2", "m3"], googleProvider("k"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Object.keys(r.ratings)).toHaveLength(1);
    expect(r.note).toMatch(/paused for today/);
    vi.unstubAllEnvs();
  });

  it("skips quietly when the provider errors", async () => {
    fetchMock.mockImplementation(async () => new Response("denied", { status: 403 }));
    const r = await placeRatings("BJS", ["m1"], googleProvider("bad"));
    expect(r.ratings).toEqual({});
    expect(r.note).toMatch(/unavailable/);
  });

  it("caps lookups per request", () => {
    expect(MAX_LOOKUPS_PER_REQUEST).toBeLessThanOrEqual(12);
  });
});

describe("picks with ratings and comfort", () => {
  const stay = (id: string, tier: Place["tier"], extra: Partial<Place> = {}): Place => ({ id, name: `Stay ${id}`, category: "sleep", tier, ...extra });
  const stays = [stay("a", "Budget"), stay("b", "Mid-range"), stay("c", "Splurge"), stay("d", "Splurge"), stay("e", "Mid-range", { thumb: "x" })];
  const ratings: Record<string, Pick<PlaceRating, "rating" | "count">> = {
    a: { rating: 4.8, count: 1500 },
    b: { rating: 4.5, count: 800 },
    c: { rating: 4.6, count: 600 },
    d: { rating: 4.9, count: 5 }, // too few ratings to decide picks
  };

  it("puts the highest rated first and says so", () => {
    const picks = picksFor(stays, "sleep", { ratings });
    expect(picks.map((x) => [x.place.id, x.label])).toEqual([
      ["a", "Highest rated · 4.8"], ["c", "Rated 4.6"], ["b", "Rated 4.5"],
    ]);
  });

  it("leans towards Luxury without hiding the true top rating", () => {
    const picks = picksFor(stays, "sleep", { ratings, comfort: "Luxury" });
    expect(picks.map((x) => [x.place.id, x.label])).toEqual([
      ["c", "Luxury pick · 4.6"], ["a", "Highest rated · 4.8"], ["b", "Rated 4.5"],
    ]);
  });

  it("Comfortable leans to mid-range, Good value to budget and mid-range", () => {
    expect(picksFor(stays, "sleep", { ratings, comfort: "Comfortable" })[0].place.id).toBe("a"); // 4.8 vs 4.5+bonus: rating still wins
    const close = { ...ratings, b: { rating: 4.7, count: 800 } };
    expect(picksFor(stays, "sleep", { ratings: close, comfort: "Comfortable" }).map((x) => x.label)[0]).toBe("Comfortable pick · 4.7");
    expect(picksFor(stays, "sleep", { ratings, comfort: "Good value" })[0].label).toBe("Highest rated · 4.8");
  });

  it("fills up from the guide when only one place is rated", () => {
    const picks = picksFor(stays, "sleep", { ratings: { b: { rating: 4.5, count: 300 } } });
    expect(picks[0]).toMatchObject({ place: { id: "b" }, label: "Highest rated · 4.5" });
    expect(picks).toHaveLength(3);
    expect(picks[1].place.id).toBe("e"); // has a photo, so the guide's next favourite
  });

  it("falls back to the guide's own signals, comfort level first", () => {
    expect(picksFor(stays, "sleep").map((x) => x.label)).toEqual(["Splurge stay", "Best value", "Easy on the budget"]);
    expect(picksFor(stays, "sleep", { comfort: "Good value" }).map((x) => x.label)).toEqual(["Best value", "Easy on the budget", "Splurge stay"]);
    expect(picksFor(stays, "sleep", { comfort: "Luxury" })[0].label).toBe("Splurge stay");
  });

  it("rates sights by rating alone", () => {
    const sights: Place[] = ["x", "y", "z", "w"].map((id) => ({ id, name: id, category: "see" }));
    const picks = picksFor(sights, "see", { ratings: { y: { rating: 4.7, count: 10000 }, z: { rating: 4.4, count: 300 } }, comfort: "Luxury" });
    expect(picks.map((x) => [x.place.id, x.label])).toEqual([["y", "Highest rated · 4.7"], ["z", "Rated 4.4"], ["x", "Must see"]]);
  });
});

describe("findPlaceByName", () => {
  const list = [
    { name: "Da Dong Roast Duck (Dongsishitiao)", alt: "大董烤鸭店" },
    { name: "Da Dong" },
    { name: "The Temple of Heaven", alt: "天坛" },
    { name: "Café Zarah" },
  ];
  it("finds exact names case- and accent-insensitively", () => {
    expect(findPlaceByName(list, "da dong")?.name).toBe("Da Dong");
    expect(findPlaceByName(list, "CAFE ZARAH")?.name).toBe("Café Zarah");
  });
  it("tries the alt name, then a loose match", () => {
    expect(findPlaceByName(list, "天坛")?.name).toBe("The Temple of Heaven");
    expect(findPlaceByName(list, "Temple of Heaven")?.name).toBe("The Temple of Heaven");
    expect(findPlaceByName(list, "Dongsishitiao")?.name).toBe("Da Dong Roast Duck (Dongsishitiao)");
  });
  it("returns nothing for blanks or no match", () => {
    expect(findPlaceByName(list, "")).toBeUndefined();
    expect(findPlaceByName(list, undefined)).toBeUndefined();
    expect(findPlaceByName(list, "Forbidden City")).toBeUndefined();
    expect(findPlaceByName(list, "da")).toBeUndefined();
  });
});

describe("hotel search links", () => {
  const ids = (code: string) => staySearchLinks(getCity(code), "2026-12-01", "2026-12-04", 2).map((l) => l.label);
  it("always leads with Booking.com, adds Trip.com in mainland China and Hong Kong, keeps Google Hotels", () => {
    expect(ids("BJS")).toEqual(["Booking.com", "Trip.com", "Google Hotels"]);
    expect(ids("HKG")).toEqual(["Booking.com", "Trip.com", "Google Hotels"]);
    expect(ids("NYC")).toEqual(["Booking.com", "Google Hotels"]);
  });
  it("adds Trip.com for Macau too", () => {
    const macau = { ...getCity("HKG"), code: "MFM", name: "Macau", country: "MO", countryName: "Macau SAR" };
    expect(staySearchLinks(macau, "2026-12-01", "2026-12-04", 2).map((l) => l.label)).toEqual(["Booking.com", "Trip.com", "Google Hotels"]);
  });
  it("pre-fills dates and guests", () => {
    const [booking, trip] = staySearchLinks(getCity("BJS"), "2026-12-01", "2026-12-04", 2);
    expect(booking.url).toContain("checkin=2026-12-01&checkout=2026-12-04&group_adults=2");
    expect(trip.url).toBe("https://www.trip.com/hotels/list?city=1&checkIn=2026-12-01&checkOut=2026-12-04&adult=2&crn=1");
  });
});

describe("stay pin labels", () => {
  it("reads a short price from the guide", () => {
    expect(priceShort("Doubles from ¥450 per night")).toBe("¥450");
    expect(priceShort("HK$900 - 1,400")).toBe("HK$900–1,400");
    expect(priceShort("RMB 300")).toBe("¥300");
    expect(priceShort("Ask at the desk")).toBeUndefined();
  });
  it("shows the rating only when the provider allows it on other maps", () => {
    const p: Place = { id: "s", name: "S", category: "sleep", tier: "Mid-range", price: "¥450" };
    const r: PlaceRating = { rating: 4.62, count: 10, reviews: [] };
    expect(stayPinLabel(p, r, true)).toBe("★ 4.6");
    expect(stayPinLabel(p, r, false)).toBe("¥450");
    expect(stayPinLabel({ ...p, price: undefined }, r, false)).toBe("$$");
  });
});

describe("price labels", () => {
  it("drops trailing punctuation from guide prices", () => {
    expect(priceShort("Doubles from ¥588, breakfast extra")).toBe("¥588");
    expect(priceShort("Rooms ¥1,200.")).toBe("¥1,200");
    expect(priceShort("¥300-450 per night")).toBe("¥300–450");
  });
});
