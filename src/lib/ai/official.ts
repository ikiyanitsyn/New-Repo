import { findCity } from "../cities";

/**
 * Official sources to verify entry rules. The AI writes the friendly summary;
 * these links are fixed so travellers can always check the authority.
 */
const STATE_DEPT = "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages";

/** travel.state.gov country-page slugs (the page is `${slug}.html`). */
const COUNTRY_PAGE: Record<string, string> = {
  CN: "China", HK: "HongKong", MO: "Macau", TW: "Taiwan", JP: "Japan", KR: "SouthKorea",
  TH: "Thailand", SG: "Singapore", VN: "Vietnam", MY: "Malaysia", ID: "Indonesia", AE: "UnitedArabEmirates",
  GB: "UnitedKingdom", IE: "Ireland", FR: "France", IT: "Italy", ES: "Spain", PT: "Portugal",
  NL: "Netherlands", BE: "Belgium", DE: "Germany", CH: "Switzerland", AT: "Austria",
  // Unsure: the State Department may list Czechia under its older name; this is the long-standing slug.
  CZ: "CzechRepublic",
  HU: "Hungary", PL: "Poland", HR: "Croatia", GR: "Greece", DK: "Denmark", SE: "Sweden",
  NO: "Norway", IS: "Iceland", TR: "Turkey",
};

/** Schengen-area countries: Americans need an ETIAS authorisation once it applies. */
const SCHENGEN = ["FR", "IT", "ES", "PT", "NL", "BE", "DE", "CH", "AT", "CZ", "HU", "PL", "HR", "GR", "DK", "SE", "NO", "IS"];
const ETIAS = { label: "EU travel authorisation (ETIAS)", url: "https://travel-europe.europa.eu/" };

const EXTRA: Record<string, { label: string; url: string }[]> = {
  ...Object.fromEntries(SCHENGEN.map((c) => [c, [ETIAS]])),
  CN: [{ label: "Chinese Embassy in the US: visas", url: "http://us.china-embassy.gov.cn/eng/visas/" }],
  HK: [{ label: "Hong Kong Immigration Department", url: "https://www.immd.gov.hk/eng/" }],
  MO: [{ label: "Macau Public Security Police: immigration", url: "https://www.fsm.gov.mo/psp/eng/" }],
  TW: [{ label: "Taiwan Bureau of Consular Affairs", url: "https://www.boca.gov.tw/" }],
  JP: [{ label: "Japan Ministry of Foreign Affairs: visas", url: "https://www.mofa.go.jp/j_info/visit/visa/" }],
  KR: [{ label: "Korea K-ETA", url: "https://www.k-eta.go.kr/" }],
  TH: [{ label: "Thailand Digital Arrival Card", url: "https://tdac.immigration.go.th/" }],
  SG: [{ label: "Singapore Arrival Card (ICA)", url: "https://www.ica.gov.sg/" }],
  VN: [{ label: "Vietnam official e-visa portal", url: "https://evisa.gov.vn/" }],
  MY: [{ label: "Malaysia Digital Arrival Card", url: "https://imigresen-online.imi.gov.my/mdac/main" }],
  ID: [{ label: "Indonesia e-Visa on Arrival", url: "https://evisa.imigrasi.go.id/" }],
  AE: [{ label: "UAE government: visas", url: "https://u.ae/en/information-and-services/visa-and-emirates-id" }],
  GB: [{ label: "UK Electronic Travel Authorisation", url: "https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta" }],
  IE: [{ label: "Irish Immigration Service", url: "https://www.irishimmigration.ie/" }],
};

export function officialLinks(cityCodes: string[]): { country: string; links: { label: string; url: string }[] }[] {
  const seen = new Map<string, string>();
  for (const c of cityCodes) {
    const city = findCity(c);
    if (city && city.country !== "US" && !seen.has(city.country)) seen.set(city.country, city.countryName);
  }
  return [...seen].map(([code, name]) => ({
    country: name,
    links: [
      ...(COUNTRY_PAGE[code] ? [{ label: `US State Department: ${name}`, url: `${STATE_DEPT}/${COUNTRY_PAGE[code]}.html` }] : []),
      ...(EXTRA[code] ?? []).filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i),
    ],
  }));
}
