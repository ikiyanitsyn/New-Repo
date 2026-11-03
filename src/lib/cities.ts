/**
 * Launch city set. `code` is the IATA metropolitan (city) code used by
 * Travelpayouts; `airports` are the individual airports, used for Google
 * Flights (SerpApi) which accepts comma-separated airport codes.
 */
export type Region = "North America" | "Europe" | "East Asia" | "Southeast Asia" | "Middle East";

export interface City {
  code: string;
  name: string;
  country: string; // ISO 3166-1 alpha-2. Hong Kong is "HK" (separate border from mainland "CN").
  countryName: string;
  region: Region;
  airports: string[];
  lat: number;
  lon: number;
  timeZone: string;
  /** Local name, shown as a subtle secondary label. */
  localName?: string;
}

export const CITIES: City[] = [
  // United States — departures
  { code: "NYC", name: "New York", country: "US", countryName: "United States", region: "North America", airports: ["JFK", "EWR", "LGA"], lat: 40.7128, lon: -74.006, timeZone: "America/New_York" },
  { code: "LAX", name: "Los Angeles", country: "US", countryName: "United States", region: "North America", airports: ["LAX"], lat: 34.0522, lon: -118.2437, timeZone: "America/Los_Angeles" },
  { code: "SFO", name: "San Francisco", country: "US", countryName: "United States", region: "North America", airports: ["SFO", "OAK", "SJC"], lat: 37.7749, lon: -122.4194, timeZone: "America/Los_Angeles" },
  { code: "CHI", name: "Chicago", country: "US", countryName: "United States", region: "North America", airports: ["ORD", "MDW"], lat: 41.8781, lon: -87.6298, timeZone: "America/Chicago" },
  { code: "MIA", name: "Miami", country: "US", countryName: "United States", region: "North America", airports: ["MIA", "FLL"], lat: 25.7617, lon: -80.1918, timeZone: "America/New_York" },
  { code: "SEA", name: "Seattle", country: "US", countryName: "United States", region: "North America", airports: ["SEA"], lat: 47.6062, lon: -122.3321, timeZone: "America/Los_Angeles" },

  // Mainland China
  { code: "BJS", name: "Beijing", localName: "北京", country: "CN", countryName: "China", region: "East Asia", airports: ["PEK", "PKX"], lat: 39.9042, lon: 116.4074, timeZone: "Asia/Shanghai" },
  { code: "SHA", name: "Shanghai", localName: "上海", country: "CN", countryName: "China", region: "East Asia", airports: ["PVG", "SHA"], lat: 31.2304, lon: 121.4737, timeZone: "Asia/Shanghai" },
  { code: "CAN", name: "Guangzhou", localName: "广州", country: "CN", countryName: "China", region: "East Asia", airports: ["CAN"], lat: 23.1291, lon: 113.2644, timeZone: "Asia/Shanghai" },
  { code: "SZX", name: "Shenzhen", localName: "深圳", country: "CN", countryName: "China", region: "East Asia", airports: ["SZX"], lat: 22.5431, lon: 114.0579, timeZone: "Asia/Shanghai" },
  { code: "CTU", name: "Chengdu", localName: "成都", country: "CN", countryName: "China", region: "East Asia", airports: ["TFU", "CTU"], lat: 30.5728, lon: 104.0668, timeZone: "Asia/Shanghai" },
  { code: "CKG", name: "Chongqing", localName: "重庆", country: "CN", countryName: "China", region: "East Asia", airports: ["CKG"], lat: 29.563, lon: 106.5516, timeZone: "Asia/Shanghai" },
  { code: "SIA", name: "Xi'an", localName: "西安", country: "CN", countryName: "China", region: "East Asia", airports: ["XIY"], lat: 34.3416, lon: 108.9398, timeZone: "Asia/Shanghai" },
  { code: "HGH", name: "Hangzhou", localName: "杭州", country: "CN", countryName: "China", region: "East Asia", airports: ["HGH"], lat: 30.2741, lon: 120.1551, timeZone: "Asia/Shanghai" },
  { code: "KWL", name: "Guilin", localName: "桂林", country: "CN", countryName: "China", region: "East Asia", airports: ["KWL"], lat: 25.2736, lon: 110.29, timeZone: "Asia/Shanghai" },

  // Hong Kong SAR (own border and immigration)
  { code: "HKG", name: "Hong Kong", localName: "香港", country: "HK", countryName: "Hong Kong SAR", region: "East Asia", airports: ["HKG"], lat: 22.3193, lon: 114.1694, timeZone: "Asia/Hong_Kong" },

  // Rest of Asia
  { code: "TYO", name: "Tokyo", localName: "東京", country: "JP", countryName: "Japan", region: "East Asia", airports: ["HND", "NRT"], lat: 35.6762, lon: 139.6503, timeZone: "Asia/Tokyo" },
  { code: "SEL", name: "Seoul", localName: "서울", country: "KR", countryName: "South Korea", region: "East Asia", airports: ["ICN", "GMP"], lat: 37.5665, lon: 126.978, timeZone: "Asia/Seoul" },
  { code: "BKK", name: "Bangkok", country: "TH", countryName: "Thailand", region: "Southeast Asia", airports: ["BKK", "DMK"], lat: 13.7563, lon: 100.5018, timeZone: "Asia/Bangkok" },
  { code: "SIN", name: "Singapore", country: "SG", countryName: "Singapore", region: "Southeast Asia", airports: ["SIN"], lat: 1.3521, lon: 103.8198, timeZone: "Asia/Singapore" },

  // Europe and the bridge
  { code: "LON", name: "London", country: "GB", countryName: "United Kingdom", region: "Europe", airports: ["LHR", "LGW", "STN"], lat: 51.5074, lon: -0.1278, timeZone: "Europe/London" },
  { code: "PAR", name: "Paris", country: "FR", countryName: "France", region: "Europe", airports: ["CDG", "ORY"], lat: 48.8566, lon: 2.3522, timeZone: "Europe/Paris" },
  { code: "ROM", name: "Rome", country: "IT", countryName: "Italy", region: "Europe", airports: ["FCO", "CIA"], lat: 41.9028, lon: 12.4964, timeZone: "Europe/Rome" },
  { code: "BCN", name: "Barcelona", country: "ES", countryName: "Spain", region: "Europe", airports: ["BCN"], lat: 41.3874, lon: 2.1686, timeZone: "Europe/Madrid" },
  { code: "AMS", name: "Amsterdam", country: "NL", countryName: "Netherlands", region: "Europe", airports: ["AMS"], lat: 52.3676, lon: 4.9041, timeZone: "Europe/Amsterdam" },
  { code: "IST", name: "Istanbul", country: "TR", countryName: "Türkiye", region: "Europe", airports: ["IST", "SAW"], lat: 41.0082, lon: 28.9784, timeZone: "Europe/Istanbul" },
];

const BY_CODE = new Map(CITIES.map((c) => [c.code, c]));

export function getCity(code: string): City {
  const c = BY_CODE.get(code);
  if (!c) throw new Error(`Unknown city code: ${code}`);
  return c;
}

export function findCity(code: string): City | undefined {
  return BY_CODE.get(code);
}

export const HOME_CITIES = CITIES.filter((c) => c.country === "US");
export const DESTINATION_CITIES = CITIES.filter((c) => c.country !== "US");

export const REGION_ORDER: Region[] = ["East Asia", "Southeast Asia", "Europe", "Middle East", "North America"];
