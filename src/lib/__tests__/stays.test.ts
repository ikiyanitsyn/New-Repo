import { describe, expect, it } from "vitest";
import { customPlaceCode, customPlaceOf, findCity, getCity, isCustomCode, registerPlaces, type CustomPlace } from "../cities";
import { mapHit } from "../places/geocode";
import { outdoorsy, rentalSearchLinks, staySearchLinks } from "../places/links";
import { placeParam } from "../places/customParam";
import { buildOverviewPrompt, daySlots } from "../ai/prompt";
import { PlanRequest, PlanResponse } from "../ai/schema";
import { searchProblem, searchStops, searchTripActions, switchTripType, type TripSearch } from "../newTrip";
import { isTrip, sampleTrip, stopsWithDates, tripLegs, type Trip } from "../trip";
import { tripReducer } from "../tripReducer";

const sierra: CustomPlace = {
  code: customPlaceCode("Sierra National Forest", 37.28206, -119.14999),
  name: "Sierra National Forest", lat: 37.28206, lon: -119.14999, country: "US", countryName: "United States", area: "California", kind: "national forest",
};
const shaver: CustomPlace = {
  code: customPlaceCode("Shaver Lake", 37.1, -119.32),
  name: "Shaver Lake", lat: 37.1, lon: -119.32, country: "US", countryName: "United States", area: "California", kind: "lake",
};

describe("places found by search", () => {
  it("get a stable code that can't clash with a catalog city", () => {
    expect(isCustomCode(sierra.code)).toBe(true);
    expect(sierra.code).toBe(customPlaceCode("sierra national forest ", 37.28206, -119.14999));
    expect(isCustomCode("BJS")).toBe(false);
  });

  it("are unknown until registered, then behave like a city", () => {
    const p = { ...sierra, code: "0ZZZZ1" };
    expect(findCity(p.code)).toBeUndefined();
    registerPlaces([p]);
    const c = getCity(p.code);
    expect(c).toMatchObject({ name: "Sierra National Forest", custom: true, region: "North America", airports: [], timeZone: "America/Los_Angeles" });
    expect(customPlaceOf(p.code)).toEqual(p);
    expect(JSON.parse(placeParam(p.code).place)).toEqual(p);
    expect(placeParam("BJS")).toEqual({});
  });

  it("are read from OpenStreetMap search results", () => {
    const p = mapHit({
      lat: "37.2820648", lon: "-119.1499896", name: "Sierra National Forest", display_name: "Sierra National Forest, California, United States",
      type: "protected_area", addresstype: "protected_area", address: { state: "California", country: "United States", country_code: "us" },
      namedetails: { name: "Sierra National Forest", "name:en": "Sierra National Forest" },
    });
    expect(p).toMatchObject({ name: "Sierra National Forest", country: "US", area: "California", kind: "national forest", lat: 37.28206 });
    expect(isCustomCode(p!.code)).toBe(true);
    expect(mapHit({ lat: "x", lon: "1", display_name: "Nowhere" })).toBeNull();
  });
});

describe("rental searches", () => {
  it("adds Hipcamp and Recreation.gov for outdoor places in the US", () => {
    registerPlaces([sierra]);
    const city = getCity(sierra.code);
    expect(outdoorsy(city)).toBe(true);
    const links = staySearchLinks(city, "2027-06-11", "2027-06-14", 4);
    expect(links.map((l) => l.label)).toEqual(["Booking.com", "Airbnb", "Vrbo", "Hipcamp", "Recreation.gov", "Google Hotels"]);
    const airbnb = links.find((l) => l.label === "Airbnb")!.url;
    expect(airbnb).toContain("Sierra%20National%20Forest%2C%20California");
    expect(airbnb).toContain("checkin=2027-06-11&checkout=2027-06-14&adults=4");
  });

  it("keeps to Airbnb and Vrbo in towns and abroad", () => {
    expect(outdoorsy(getCity("BJS"))).toBe(false);
    expect(rentalSearchLinks("Lisbon, Portugal", "PT", "2027-06-11", "2027-06-14", 2, true).map((l) => l.label)).toEqual(["Airbnb", "Vrbo"]);
  });
});

const staySearch = (patch: Partial<TripSearch> = {}): TripSearch => ({
  tripType: "stay", home: "NYC", to: sierra.code, cities: [], departDate: "2027-06-11", returnDate: "2027-06-14", nights: 3, adults: 4, cabin: "economy", ...patch,
});

describe("stay trips", () => {
  registerPlaces([sierra, shaver]);

  it("need a place and check-out after check-in, but no home city", () => {
    expect(searchProblem(staySearch())).toBeNull();
    expect(searchProblem(staySearch({ home: "XXX" }))).toBeNull();
    expect(searchProblem(staySearch({ to: undefined }))?.field).toBe("to");
    expect(searchProblem(staySearch({ returnDate: "2027-06-11" }))?.field).toBe("dates");
    expect(searchStops(staySearch())).toEqual([{ city: sierra.code, nights: 3 }]);
  });

  it("build a trip with the place saved in it and no flights", () => {
    let t: Trip = sampleTrip();
    for (const a of searchTripActions(staySearch())) t = tripReducer(t, a);
    expect(t.tripType).toBe("stay");
    expect(t.returnHome).toBe(false);
    expect(t.title).toBe("Sierra National Forest stay");
    expect(t.places).toEqual([sierra]);
    expect(t.adults).toBe(4);
    expect(tripLegs(t)).toEqual([]);
    const [st] = stopsWithDates(t);
    expect([st.arrive, st.depart, st.nights]).toEqual(["2027-06-11", "2027-06-14", 3]); // no flight day
    expect(isTrip(JSON.parse(JSON.stringify(t)))).toBe(true);
  });

  it("drive between places rather than fly", () => {
    let t: Trip = sampleTrip();
    for (const a of searchTripActions(staySearch())) t = tripReducer(t, a);
    t = tripReducer(t, { type: "addPlaces", places: [shaver] });
    t = tripReducer(t, { type: "addStop", city: shaver.code });
    const legs = tripLegs(t);
    expect(legs.map((l) => [l.kind, l.mode])).toEqual([["between", "car"]]);
  });

  it("drop a searched place when switching to a flight trip", () => {
    expect(switchTripType(staySearch(), "round").to).toBeUndefined();
    expect(switchTripType(staySearch({ to: "BJS" }), "round").to).toBe("BJS");
  });
});

describe("the concierge for a stay", () => {
  const request = PlanRequest.parse({
    request: "Cabin with a lake view, easy hikes",
    trip: {
      home: "NYC", departDate: "2027-06-11", adults: 4, cabin: "economy", returnHome: false, tripType: "stay",
      stops: [{ city: sierra.code, nights: 3 }], modes: [], places: [sierra],
    },
  });

  it("writes days from check-in to check-out with no flight", () => {
    const slots = daySlots(request);
    expect(slots.map((s) => s.date)).toEqual(["2027-06-11", "2027-06-12", "2027-06-13", "2027-06-14"]);
    expect(slots[0].note).toMatch(/check in/);
    expect(slots[3].note).toMatch(/check out/);
    expect(slots.map((s) => s.note).join(" ")).not.toMatch(/fly|flight/);
  });

  it("asks where to stay and for an outdoors brief, not visas", () => {
    const { system, user } = buildOverviewPrompt(request);
    expect(system).toMatch(/"stays"/);
    expect(system).toMatch(/3-4 options/);
    expect(system).toMatch(/Permits & passes/);
    expect(system).not.toMatch(/Visa & entry/);
    expect(user).toMatch(/Sierra National Forest \(national forest, California\)/);
    expect(user).toMatch(/no flights/);
  });

  it("keeps stay ideas from the reply", () => {
    const r = PlanResponse.parse({
      title: "Lakes and granite",
      stays: [{ city: sierra.code.toLowerCase(), area: "Shaver Lake", kind: "cabin rental", why: "Lakeside cabins.", price: "$200–350 a night" }, { area: "" }],
    });
    expect(r.stays).toEqual([{ city: sierra.code, area: "Shaver Lake", kind: "cabin rental", why: "Lakeside cabins.", price: "$200–350 a night" }]);
  });
});
