import { findCity } from "../cities";

/**
 * Official sources to verify entry rules. The AI writes the friendly summary;
 * these links are fixed so travellers can always check the authority.
 */
const STATE_DEPT = "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages";

const COUNTRY_PAGE: Record<string, string> = {
  CN: "China", HK: "HongKong", JP: "Japan", KR: "SouthKorea", TH: "Thailand", SG: "Singapore",
  GB: "UnitedKingdom", FR: "France", IT: "Italy", ES: "Spain", NL: "Netherlands", TR: "Turkey",
};

const EXTRA: Record<string, { label: string; url: string }[]> = {
  CN: [{ label: "Chinese Embassy in the US: visas", url: "http://us.china-embassy.gov.cn/eng/visas/" }],
  HK: [{ label: "Hong Kong Immigration Department", url: "https://www.immd.gov.hk/eng/" }],
  JP: [{ label: "Japan Ministry of Foreign Affairs: visas", url: "https://www.mofa.go.jp/j_info/visit/visa/" }],
  KR: [{ label: "Korea K-ETA", url: "https://www.k-eta.go.kr/" }],
  GB: [{ label: "UK Electronic Travel Authorisation", url: "https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta" }],
  FR: [{ label: "EU travel authorisation (ETIAS)", url: "https://travel-europe.europa.eu/" }],
  IT: [{ label: "EU travel authorisation (ETIAS)", url: "https://travel-europe.europa.eu/" }],
  ES: [{ label: "EU travel authorisation (ETIAS)", url: "https://travel-europe.europa.eu/" }],
  NL: [{ label: "EU travel authorisation (ETIAS)", url: "https://travel-europe.europa.eu/" }],
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
