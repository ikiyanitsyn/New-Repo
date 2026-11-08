import { findCity, type Region } from "./cities";

/**
 * Airline stopover programmes, shown on the home page as options.
 *
 * Terms change often, so every card says "Check current terms" and links to
 * the airline's own page. Summaries are deliberately short and hedged
 * ("typically", "up to"): they say what the programme is for, not a promise.
 *
 * Verification (fetched 2026-11-08 from the build sandbox):
 *  - VERIFIED: the page loaded and the summary matches what it says.
 *  - INDEXED: the airline's site blocks automated requests (HTTP 403 or a reset
 *    connection), so the page could not be read; the URL pattern appears in
 *    search-engine results for the airline's own domain, and the summary comes
 *    from several consistent secondary sources. Re-check these by hand.
 * Each entry's `verified` field records which.
 */

/** Broad route families a programme suits, from the traveller's point of view. */
export type RouteFamily = "US → Europe" | "US → Asia" | "US → Middle East" | "US → Africa" | "Europe → Asia" | "US → Oceania";

export interface StopoverProgramme {
  id: string;
  airline: string;
  programme: string;
  /** Catalog city code of the hub, when the catalog has it (so it can become a stop). */
  hubCity?: string;
  /** Hub name, always shown (for hubs the catalog lacks, e.g. Doha, Helsinki). */
  hubName: string;
  /** One or two plain sentences: the typical benefit. */
  benefit: string;
  /** Typical maximum stay in nights, when the programme states one. */
  maxNights?: number;
  suits: RouteFamily[];
  /** The airline's (or, for policy-based transit, the government's) official terms page. Always https. */
  termsUrl: string;
  verified: "verified" | "indexed";
  /** What was checked, for the next person who updates this list. */
  verifiedNote: string;
}

export const STOPOVER_PROGRAMMES: StopoverProgramme[] = [
  {
    id: "icelandair",
    airline: "Icelandair",
    programme: "Stopover in Iceland",
    hubCity: "REK",
    hubName: "Reykjavík",
    benefit: "Add a stopover in Iceland on the way to or from Europe, typically up to 7 nights, at no extra airfare. Hotels and tours are extra.",
    maxNights: 7,
    suits: ["US → Europe"],
    termsUrl: "https://www.icelandair.com/flights/stopover/",
    verified: "indexed",
    // 403 to curl. The /flights/stopover/ section is linked from icelandair.com's own
    // /flights/stopover/adventures/ pages; "1 to 7 days at no additional airfare" per icelandair.co.uk.
    verifiedNote: "Site returns 403 to bots; URL from Icelandair's own links; 1–7 nights per icelandair.co.uk.",
  },
  {
    id: "tap",
    airline: "TAP Air Portugal",
    programme: "Portugal Stopover",
    hubCity: "LIS",
    hubName: "Lisbon or Porto",
    benefit: "A free stopover in Lisbon or Porto of up to 10 days, outbound or on the way home, plus partner discounts and 25% off a TAP flight within Portugal.",
    maxNights: 10,
    suits: ["US → Europe", "US → Africa"],
    termsUrl: "https://www.flytap.com/en-us/stopover",
    verified: "verified",
    verifiedNote: "Page loaded: 'free stopover in Lisbon or Porto … up to 10 days', '25% discount on any flight within Portugal'.",
  },
  {
    id: "turkish",
    airline: "Turkish Airlines",
    programme: "Stopover in Istanbul · Touristanbul",
    hubCity: "IST",
    hubName: "Istanbul",
    benefit: "On qualifying long connections in Istanbul, a complimentary hotel night (more in business class). Shorter layovers of about 6–24 hours can join the free Touristanbul city tour.",
    suits: ["US → Europe", "US → Asia", "US → Middle East", "US → Africa", "Europe → Asia"],
    termsUrl: "https://www.turkishairlines.com/en-us/flights/stopover/",
    verified: "indexed",
    // Connection reset for curl. Localised copies of /flights/stopover/ (de-de, es-us, es-int…) are in
    // search results. Eligibility (≈20+ h connection, TK-operated) varies by source, hence the hedging.
    verifiedNote: "Site resets bot connections; /flights/stopover/ is indexed in several locales; details vary by source.",
  },
  {
    id: "qatar",
    airline: "Qatar Airways",
    programme: "Qatar Stopover",
    hubName: "Doha",
    benefit: "Discounted Doha hotel packages for a stopover, from about US$14 per person per night (4-star, shared room). The eligible length of stay depends on where you fly from.",
    suits: ["US → Asia", "US → Middle East", "US → Africa", "US → Oceania"],
    termsUrl: "https://www.qatarairways.com/en-us/offers/qatar-stopover-TA.html",
    verified: "indexed",
    // Connection reset for curl. The en-us page is in search results; "$14 per person … double room
    // share for 1 night" appears on Qatar Airways' regional pages. Doha is not in the city catalog.
    verifiedNote: "Site resets bot connections; en-us page indexed; from-$14 rate on regional Qatar pages.",
  },
  {
    id: "finnair",
    airline: "Finnair",
    programme: "Finnair Stopover",
    hubName: "Helsinki",
    benefit: "Stop in Helsinki on the way between Europe and Asia, typically for up to 5 days at no extra airfare on eligible fares.",
    maxNights: 5,
    suits: ["US → Asia", "Europe → Asia", "US → Europe"],
    termsUrl: "https://www.finnair.com/us-en/stopover",
    verified: "indexed",
    // 403 to curl and no official page in search results; "up to 5 days" from several older
    // secondary sources. Least certain entry: check the URL and terms by hand. Helsinki is not in the catalog.
    verifiedNote: "Could not verify: 403 to bots and not found in search; up to 5 days per older secondary sources.",
  },
  {
    id: "singapore",
    airline: "Singapore Airlines",
    programme: "Singapore Stopover",
    hubCity: "SIN",
    hubName: "Singapore",
    benefit: "Book a Singapore stopover as a multi-city trip and get up to S$20 in Changi transit e-vouchers, plus partner hotel deals.",
    suits: ["US → Asia", "Europe → Asia", "US → Oceania"],
    termsUrl: "https://www.singaporeair.com/en_UK/us/plan-travel/privileges/singapore-stopover/",
    verified: "verified",
    // The older "Singapore Stopover Holiday" package URL now 404s; this is the current page.
    verifiedNote: "Page loaded: 'Book your Singapore Stopover and get up to S$20 Changi Transit e-Vouchers' via Multi-city/Stopovers.",
  },
  {
    id: "emirates",
    airline: "Emirates",
    programme: "Dubai Stopover",
    hubCity: "DXB",
    hubName: "Dubai",
    benefit: "Add a few days in Dubai on the way out or back when you book, with hotel and tour packages available through Emirates.",
    suits: ["US → Asia", "US → Middle East", "US → Africa", "US → Oceania", "Europe → Asia"],
    termsUrl: "https://www.emirates.com/us/english/discover-dubai/dubai-stopover/",
    verified: "verified",
    verifiedNote: "Page loaded: 'You can add a stopover when you book your flights, whether it's on your outbound journey or on your return.'",
  },
  {
    id: "china-transit",
    airline: "Air China · China Eastern",
    programme: "China 240-hour visa-free transit",
    hubCity: "BJS",
    hubName: "Beijing or Shanghai",
    benefit: "Not an airline perk but a government policy: US passport holders flying on to a third country or region (Hong Kong counts) can usually stay up to 240 hours without a visa, within the permitted provinces.",
    suits: ["US → Asia"],
    // Government page: neither airline publishes a stable English terms page for this, and their
    // transit-hotel offers could not be confirmed (Air China's link is an app page; China Eastern's 404s).
    termsUrl: "https://english.shanghai.gov.cn/en-Individuals-ImmigrationandVisas-Visa-freepolicies/20260709/d70a1231ba4641ff9a024e53751ad480.html",
    verified: "verified",
    verifiedNote: "Shanghai government page (source: National Immigration Administration, updated Aug 20 2026) loaded: 57 countries incl. the United States, 65 ports, 240 hours.",
  },
];

export const findProgramme = (id: string) => STOPOVER_PROGRAMMES.find((p) => p.id === id);

/** The broad route family for a US departure to a destination city. */
export function routeFamily(fromRegion: Region, toRegion: Region): RouteFamily | null {
  if (fromRegion === "North America") {
    if (toRegion === "Europe") return "US → Europe";
    if (toRegion === "East Asia" || toRegion === "Southeast Asia") return "US → Asia";
    if (toRegion === "Middle East") return "US → Middle East";
    return null;
  }
  if (fromRegion === "Europe" && (toRegion === "East Asia" || toRegion === "Southeast Asia")) return "Europe → Asia";
  return null;
}

/** Programmes that suit a route, those whose hub can become a stop first. Never the destination's own hub. */
export function programmesFor(from: string, to: string): StopoverProgramme[] {
  const a = findCity(from);
  const b = findCity(to);
  if (!a || !b) return [];
  const family = routeFamily(a.region, b.region);
  if (!family) return [];
  return STOPOVER_PROGRAMMES
    .filter((p) => p.suits.includes(family) && p.hubCity !== to && !(p.id === "china-transit" && b.country === "CN"))
    .sort((x, y) => Number(!x.hubCity) - Number(!y.hubCity));
}
