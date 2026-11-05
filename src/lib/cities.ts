/**
 * City catalog. `code` is the city's identity everywhere in the app (saved
 * trips, URLs, AI plans), so existing codes must never change.
 *
 * For cities with their own airport, `code` is the IATA metropolitan (city)
 * code or main airport code, which Travelpayouts and Skyscanner accept.
 * For cities without one (Suzhou, Kyoto, Pingyao…), `code` is an internal
 * three-letter code that is unique in this catalog, and `flightCode` is the
 * IATA code to search instead (use `flightCodeOf`). `airports` are the real
 * individual airports, used for Google Flights (SerpApi), which accepts
 * comma-separated airport codes.
 *
 * Coordinates are city centres (or the old town travellers stay in, where
 * noted), rounded to about 100 m. Compiled from general knowledge without
 * network access; checked for plausibility, not against a live source.
 */
export type Region = "North America" | "Europe" | "East Asia" | "Southeast Asia" | "Middle East";

export interface City {
  code: string;
  name: string;
  country: string; // ISO 3166-1 alpha-2. Hong Kong is "HK", Macau "MO" (separate borders from mainland "CN").
  countryName: string;
  region: Region;
  airports: string[];
  lat: number;
  lon: number;
  timeZone: string;
  /** Local name, shown as a subtle secondary label and searchable. */
  localName?: string;
  /** IATA code for flight searches when `code` is internal (the city has no airport of its own). */
  flightCode?: string;
  /** Wikivoyage article title, set only where it differs from `name`. */
  wikivoyageTitle?: string;
}

type Base = Omit<City, "country" | "countryName" | "region">;
const group = (country: string, countryName: string, region: Region, cities: Base[]): City[] =>
  cities.map((c) => ({ ...c, country, countryName, region }));

export const CITIES: City[] = [
  // United States — departures
  ...group("US", "United States", "North America", [
    { code: "NYC", name: "New York", wikivoyageTitle: "New York City", airports: ["JFK", "EWR", "LGA"], lat: 40.7128, lon: -74.006, timeZone: "America/New_York" },
    { code: "LAX", name: "Los Angeles", airports: ["LAX"], lat: 34.0522, lon: -118.2437, timeZone: "America/Los_Angeles" },
    { code: "SFO", name: "San Francisco", airports: ["SFO", "OAK", "SJC"], lat: 37.7749, lon: -122.4194, timeZone: "America/Los_Angeles" },
    { code: "CHI", name: "Chicago", airports: ["ORD", "MDW"], lat: 41.8781, lon: -87.6298, timeZone: "America/Chicago" },
    { code: "MIA", name: "Miami", airports: ["MIA", "FLL"], lat: 25.7617, lon: -80.1918, timeZone: "America/New_York" },
    { code: "SEA", name: "Seattle", airports: ["SEA"], lat: 47.6062, lon: -122.3321, timeZone: "America/Los_Angeles" },
    { code: "BOS", name: "Boston", airports: ["BOS"], lat: 42.3601, lon: -71.0589, timeZone: "America/New_York" },
    { code: "WAS", name: "Washington DC", wikivoyageTitle: "Washington, D.C.", airports: ["IAD", "DCA", "BWI"], lat: 38.9072, lon: -77.0369, timeZone: "America/New_York" },
    { code: "DFW", name: "Dallas", airports: ["DFW", "DAL"], lat: 32.7767, lon: -96.797, timeZone: "America/Chicago" },
    { code: "HOU", name: "Houston", airports: ["IAH", "HOU"], lat: 29.7604, lon: -95.3698, timeZone: "America/Chicago" },
    { code: "ATL", name: "Atlanta", airports: ["ATL"], lat: 33.749, lon: -84.388, timeZone: "America/New_York" },
    { code: "DEN", name: "Denver", airports: ["DEN"], lat: 39.7392, lon: -104.9903, timeZone: "America/Denver" },
    { code: "HNL", name: "Honolulu", airports: ["HNL"], lat: 21.3069, lon: -157.8583, timeZone: "Pacific/Honolulu" },
  ]),

  // Mainland China
  ...group("CN", "China", "East Asia", [
    { code: "BJS", name: "Beijing", localName: "北京", airports: ["PEK", "PKX"], lat: 39.9042, lon: 116.4074, timeZone: "Asia/Shanghai" },
    { code: "SHA", name: "Shanghai", localName: "上海", airports: ["PVG", "SHA"], lat: 31.2304, lon: 121.4737, timeZone: "Asia/Shanghai" },
    { code: "CAN", name: "Guangzhou", localName: "广州", airports: ["CAN"], lat: 23.1291, lon: 113.2644, timeZone: "Asia/Shanghai" },
    { code: "SZX", name: "Shenzhen", localName: "深圳", airports: ["SZX"], lat: 22.5431, lon: 114.0579, timeZone: "Asia/Shanghai" },
    { code: "CTU", name: "Chengdu", localName: "成都", airports: ["TFU", "CTU"], lat: 30.5728, lon: 104.0668, timeZone: "Asia/Shanghai" },
    { code: "CKG", name: "Chongqing", localName: "重庆", airports: ["CKG"], lat: 29.563, lon: 106.5516, timeZone: "Asia/Shanghai" },
    { code: "SIA", name: "Xi'an", localName: "西安", airports: ["XIY"], lat: 34.3416, lon: 108.9398, timeZone: "Asia/Shanghai" },
    { code: "HGH", name: "Hangzhou", localName: "杭州", airports: ["HGH"], lat: 30.2741, lon: 120.1551, timeZone: "Asia/Shanghai" },
    { code: "KWL", name: "Guilin", localName: "桂林", airports: ["KWL"], lat: 25.2736, lon: 110.29, timeZone: "Asia/Shanghai" },
    // No airport: fly into Shanghai (Hongqiao is ~25 min by train) or Wuxi Sunan (WUX).
    { code: "SUZ", name: "Suzhou", localName: "苏州", flightCode: "SHA", airports: ["SHA", "PVG", "WUX"], lat: 31.2989, lon: 120.5853, timeZone: "Asia/Shanghai" },
    { code: "NKG", name: "Nanjing", localName: "南京", airports: ["NKG"], lat: 32.0603, lon: 118.7969, timeZone: "Asia/Shanghai" },
    { code: "KMG", name: "Kunming", localName: "昆明", airports: ["KMG"], lat: 25.0389, lon: 102.7183, timeZone: "Asia/Shanghai" },
    // Dali old town, where most visitors stay (Xiaguan, the modern centre, is ~15 km south).
    { code: "DLU", name: "Dali", localName: "大理", airports: ["DLU"], lat: 25.6935, lon: 100.1636, timeZone: "Asia/Shanghai" },
    { code: "LJG", name: "Lijiang", localName: "丽江", airports: ["LJG"], lat: 26.8765, lon: 100.2336, timeZone: "Asia/Shanghai" },
    // City centre; the national forest park at Wulingyuan is ~30 km north.
    { code: "DYG", name: "Zhangjiajie", localName: "张家界", airports: ["DYG"], lat: 29.1171, lon: 110.4792, timeZone: "Asia/Shanghai" },
    { code: "CSX", name: "Changsha", localName: "长沙", airports: ["CSX"], lat: 28.2282, lon: 112.9388, timeZone: "Asia/Shanghai" },
    { code: "KWE", name: "Guiyang", localName: "贵阳", airports: ["KWE"], lat: 26.647, lon: 106.6302, timeZone: "Asia/Shanghai" },
    { code: "XMN", name: "Xiamen", localName: "厦门", airports: ["XMN"], lat: 24.4798, lon: 118.0894, timeZone: "Asia/Shanghai" },
    { code: "TAO", name: "Qingdao", localName: "青岛", airports: ["TAO"], lat: 36.0671, lon: 120.3826, timeZone: "Asia/Shanghai" },
    { code: "HRB", name: "Harbin", localName: "哈尔滨", airports: ["HRB"], lat: 45.8038, lon: 126.535, timeZone: "Asia/Shanghai" },
    // Tunxi, the town that serves the mountain (Huangshan North station, TXN airport).
    // The scenic area itself is ~60 km north-west.
    { code: "TXN", name: "Huangshan", localName: "黄山", airports: ["TXN"], lat: 29.7147, lon: 118.3375, timeZone: "Asia/Shanghai" },
    { code: "LYA", name: "Luoyang", localName: "洛阳", airports: ["LYA"], lat: 34.6197, lon: 112.454, timeZone: "Asia/Shanghai" },
    // No airport: Taiyuan Wusu (TYN) is about an hour away by road or rail.
    { code: "PYO", name: "Pingyao", localName: "平遥", flightCode: "TYN", airports: ["TYN"], lat: 37.2018, lon: 112.1757, timeZone: "Asia/Shanghai" },
    { code: "DNH", name: "Dunhuang", localName: "敦煌", airports: ["DNH"], lat: 40.1421, lon: 94.6619, timeZone: "Asia/Shanghai" },
    // Tibet keeps Beijing time. Foreign visitors also need a Tibet Travel Permit and a licensed tour.
    { code: "LXA", name: "Lhasa", localName: "拉萨", airports: ["LXA"], lat: 29.652, lon: 91.1721, timeZone: "Asia/Shanghai" },
    { code: "SYX", name: "Sanya", localName: "三亚", airports: ["SYX"], lat: 18.2528, lon: 109.512, timeZone: "Asia/Shanghai" },
  ]),

  // Hong Kong SAR (own border and immigration)
  ...group("HK", "Hong Kong SAR", "East Asia", [
    { code: "HKG", name: "Hong Kong", localName: "香港", airports: ["HKG"], lat: 22.3193, lon: 114.1694, timeZone: "Asia/Hong_Kong" },
  ]),
  // Macau SAR (own border and immigration, separate from mainland China and from Hong Kong)
  ...group("MO", "Macau SAR", "East Asia", [
    { code: "MFM", name: "Macau", localName: "澳門", airports: ["MFM"], lat: 22.1987, lon: 113.5439, timeZone: "Asia/Macau" },
  ]),

  // Rest of East Asia
  ...group("JP", "Japan", "East Asia", [
    { code: "TYO", name: "Tokyo", localName: "東京", airports: ["HND", "NRT"], lat: 35.6762, lon: 139.6503, timeZone: "Asia/Tokyo" },
    // No airport: Kansai (KIX) and Itami (ITM) serve both Kyoto and Osaka.
    { code: "UKY", name: "Kyoto", localName: "京都", flightCode: "OSA", airports: ["KIX", "ITM"], lat: 35.0116, lon: 135.7681, timeZone: "Asia/Tokyo" },
    { code: "OSA", name: "Osaka", localName: "大阪", airports: ["KIX", "ITM"], lat: 34.6937, lon: 135.5023, timeZone: "Asia/Tokyo" },
    { code: "HIJ", name: "Hiroshima", localName: "広島", airports: ["HIJ"], lat: 34.3853, lon: 132.4553, timeZone: "Asia/Tokyo" },
    { code: "SPK", name: "Sapporo", localName: "札幌", airports: ["CTS"], lat: 43.0618, lon: 141.3545, timeZone: "Asia/Tokyo" },
  ]),
  ...group("KR", "South Korea", "East Asia", [
    { code: "SEL", name: "Seoul", localName: "서울", airports: ["ICN", "GMP"], lat: 37.5665, lon: 126.978, timeZone: "Asia/Seoul" },
    { code: "PUS", name: "Busan", localName: "부산", airports: ["PUS"], lat: 35.1796, lon: 129.0756, timeZone: "Asia/Seoul" },
    { code: "CJU", name: "Jeju", localName: "제주", airports: ["CJU"], lat: 33.4996, lon: 126.5312, timeZone: "Asia/Seoul" },
  ]),
  ...group("TW", "Taiwan", "East Asia", [
    { code: "TPE", name: "Taipei", localName: "臺北", airports: ["TPE", "TSA"], lat: 25.033, lon: 121.5654, timeZone: "Asia/Taipei" },
  ]),

  // Southeast Asia
  ...group("TH", "Thailand", "Southeast Asia", [
    { code: "BKK", name: "Bangkok", localName: "กรุงเทพฯ", airports: ["BKK", "DMK"], lat: 13.7563, lon: 100.5018, timeZone: "Asia/Bangkok" },
    { code: "CNX", name: "Chiang Mai", localName: "เชียงใหม่", airports: ["CNX"], lat: 18.7883, lon: 98.9853, timeZone: "Asia/Bangkok" },
    // Phuket Town; the west-coast beaches are 20–40 min away.
    { code: "HKT", name: "Phuket", localName: "ภูเก็ต", airports: ["HKT"], lat: 7.8804, lon: 98.3923, timeZone: "Asia/Bangkok" },
  ]),
  ...group("SG", "Singapore", "Southeast Asia", [
    { code: "SIN", name: "Singapore", airports: ["SIN"], lat: 1.3521, lon: 103.8198, timeZone: "Asia/Singapore" },
  ]),
  ...group("VN", "Vietnam", "Southeast Asia", [
    { code: "HAN", name: "Hanoi", localName: "Hà Nội", airports: ["HAN"], lat: 21.0278, lon: 105.8342, timeZone: "Asia/Ho_Chi_Minh" },
    { code: "SGN", name: "Ho Chi Minh City", localName: "Sài Gòn", airports: ["SGN"], lat: 10.7769, lon: 106.7009, timeZone: "Asia/Ho_Chi_Minh" },
    { code: "DAD", name: "Da Nang", localName: "Đà Nẵng", airports: ["DAD"], lat: 16.0544, lon: 108.2022, timeZone: "Asia/Ho_Chi_Minh" },
    // No airport: Da Nang (DAD) is about 45 minutes by road.
    { code: "HOI", name: "Hoi An", localName: "Hội An", flightCode: "DAD", airports: ["DAD"], lat: 15.8801, lon: 108.338, timeZone: "Asia/Ho_Chi_Minh" },
  ]),
  ...group("MY", "Malaysia", "Southeast Asia", [
    { code: "KUL", name: "Kuala Lumpur", airports: ["KUL"], lat: 3.139, lon: 101.6869, timeZone: "Asia/Kuala_Lumpur" },
  ]),
  ...group("ID", "Indonesia", "Southeast Asia", [
    // Denpasar, Bali's capital, beside Ngurah Rai airport; Ubud and the beaches are 20–60 min away.
    { code: "DPS", name: "Bali", localName: "Denpasar", airports: ["DPS"], lat: -8.6705, lon: 115.2126, timeZone: "Asia/Makassar" },
  ]),

  // Middle East
  ...group("AE", "United Arab Emirates", "Middle East", [
    { code: "DXB", name: "Dubai", localName: "دبي", airports: ["DXB", "DWC"], lat: 25.2048, lon: 55.2708, timeZone: "Asia/Dubai" },
  ]),

  // Europe and the bridge
  ...group("GB", "United Kingdom", "Europe", [
    { code: "LON", name: "London", airports: ["LHR", "LGW", "STN"], lat: 51.5074, lon: -0.1278, timeZone: "Europe/London" },
    { code: "EDI", name: "Edinburgh", airports: ["EDI"], lat: 55.9533, lon: -3.1883, timeZone: "Europe/London" },
  ]),
  ...group("IE", "Ireland", "Europe", [
    { code: "DUB", name: "Dublin", localName: "Baile Átha Cliath", airports: ["DUB"], lat: 53.3498, lon: -6.2603, timeZone: "Europe/Dublin" },
  ]),
  ...group("FR", "France", "Europe", [
    { code: "PAR", name: "Paris", airports: ["CDG", "ORY"], lat: 48.8566, lon: 2.3522, timeZone: "Europe/Paris" },
    { code: "NCE", name: "Nice", airports: ["NCE"], lat: 43.7102, lon: 7.262, timeZone: "Europe/Paris" },
    { code: "LYS", name: "Lyon", airports: ["LYS"], lat: 45.764, lon: 4.8357, timeZone: "Europe/Paris" },
  ]),
  ...group("IT", "Italy", "Europe", [
    { code: "ROM", name: "Rome", localName: "Roma", airports: ["FCO", "CIA"], lat: 41.9028, lon: 12.4964, timeZone: "Europe/Rome" },
    { code: "MIL", name: "Milan", localName: "Milano", airports: ["MXP", "LIN", "BGY"], lat: 45.4642, lon: 9.19, timeZone: "Europe/Rome" },
    // Pisa (PSA) is about an hour by train and often has more flights.
    { code: "FLR", name: "Florence", localName: "Firenze", airports: ["FLR", "PSA"], lat: 43.7696, lon: 11.2558, timeZone: "Europe/Rome" },
    { code: "VCE", name: "Venice", localName: "Venezia", airports: ["VCE", "TSF"], lat: 45.4408, lon: 12.3155, timeZone: "Europe/Rome" },
    // Naples is the rail and ferry gateway to Pompeii, Sorrento, Capri and the Amalfi Coast.
    { code: "NAP", name: "Naples", localName: "Napoli", airports: ["NAP"], lat: 40.8518, lon: 14.2681, timeZone: "Europe/Rome" },
  ]),
  ...group("ES", "Spain", "Europe", [
    { code: "BCN", name: "Barcelona", airports: ["BCN"], lat: 41.3874, lon: 2.1686, timeZone: "Europe/Madrid" },
    { code: "MAD", name: "Madrid", airports: ["MAD"], lat: 40.4168, lon: -3.7038, timeZone: "Europe/Madrid" },
    { code: "SVQ", name: "Seville", localName: "Sevilla", airports: ["SVQ"], lat: 37.3891, lon: -5.9845, timeZone: "Europe/Madrid" },
  ]),
  ...group("PT", "Portugal", "Europe", [
    { code: "LIS", name: "Lisbon", localName: "Lisboa", airports: ["LIS"], lat: 38.7223, lon: -9.1393, timeZone: "Europe/Lisbon" },
    { code: "OPO", name: "Porto", airports: ["OPO"], lat: 41.1579, lon: -8.6291, timeZone: "Europe/Lisbon" },
  ]),
  ...group("NL", "Netherlands", "Europe", [
    { code: "AMS", name: "Amsterdam", airports: ["AMS"], lat: 52.3676, lon: 4.9041, timeZone: "Europe/Amsterdam" },
  ]),
  ...group("BE", "Belgium", "Europe", [
    { code: "BRU", name: "Brussels", localName: "Bruxelles", airports: ["BRU", "CRL"], lat: 50.8503, lon: 4.3517, timeZone: "Europe/Brussels" },
    // No airport of its own: Brussels Airport is about 1½ hours by direct train.
    { code: "BRG", name: "Bruges", localName: "Brugge", flightCode: "BRU", airports: ["BRU"], lat: 51.2093, lon: 3.2247, timeZone: "Europe/Brussels" },
  ]),
  ...group("DE", "Germany", "Europe", [
    { code: "BER", name: "Berlin", airports: ["BER"], lat: 52.52, lon: 13.405, timeZone: "Europe/Berlin" },
    { code: "MUC", name: "Munich", localName: "München", airports: ["MUC"], lat: 48.1351, lon: 11.582, timeZone: "Europe/Berlin" },
  ]),
  ...group("CH", "Switzerland", "Europe", [
    { code: "ZRH", name: "Zurich", localName: "Zürich", wikivoyageTitle: "Zürich", airports: ["ZRH"], lat: 47.3769, lon: 8.5417, timeZone: "Europe/Zurich" },
    // No airport: Zurich Airport is about an hour by direct train.
    { code: "LUZ", name: "Lucerne", localName: "Luzern", flightCode: "ZRH", airports: ["ZRH"], lat: 47.0502, lon: 8.3093, timeZone: "Europe/Zurich" },
  ]),
  ...group("AT", "Austria", "Europe", [
    { code: "VIE", name: "Vienna", localName: "Wien", airports: ["VIE"], lat: 48.2082, lon: 16.3738, timeZone: "Europe/Vienna" },
  ]),
  ...group("CZ", "Czechia", "Europe", [
    { code: "PRG", name: "Prague", localName: "Praha", airports: ["PRG"], lat: 50.0755, lon: 14.4378, timeZone: "Europe/Prague" },
  ]),
  ...group("HU", "Hungary", "Europe", [
    { code: "BUD", name: "Budapest", airports: ["BUD"], lat: 47.4979, lon: 19.0402, timeZone: "Europe/Budapest" },
  ]),
  ...group("PL", "Poland", "Europe", [
    { code: "KRK", name: "Krakow", localName: "Kraków", wikivoyageTitle: "Kraków", airports: ["KRK"], lat: 50.0647, lon: 19.945, timeZone: "Europe/Warsaw" },
  ]),
  ...group("HR", "Croatia", "Europe", [
    { code: "DBV", name: "Dubrovnik", airports: ["DBV"], lat: 42.6507, lon: 18.0944, timeZone: "Europe/Zagreb" },
  ]),
  ...group("GR", "Greece", "Europe", [
    { code: "ATH", name: "Athens", localName: "Αθήνα", airports: ["ATH"], lat: 37.9838, lon: 23.7275, timeZone: "Europe/Athens" },
    // Fira, the island's main town.
    { code: "JTR", name: "Santorini", localName: "Σαντορίνη", airports: ["JTR"], lat: 36.4166, lon: 25.4318, timeZone: "Europe/Athens" },
  ]),
  ...group("DK", "Denmark", "Europe", [
    { code: "CPH", name: "Copenhagen", localName: "København", airports: ["CPH"], lat: 55.6761, lon: 12.5683, timeZone: "Europe/Copenhagen" },
  ]),
  ...group("SE", "Sweden", "Europe", [
    { code: "STO", name: "Stockholm", airports: ["ARN", "BMA"], lat: 59.3293, lon: 18.0686, timeZone: "Europe/Stockholm" },
  ]),
  ...group("NO", "Norway", "Europe", [
    { code: "OSL", name: "Oslo", airports: ["OSL"], lat: 59.9139, lon: 10.7522, timeZone: "Europe/Oslo" },
  ]),
  ...group("IS", "Iceland", "Europe", [
    // Metro code REK; international flights use Keflavík (KEF), about 45 min from the city.
    { code: "REK", name: "Reykjavik", localName: "Reykjavík", wikivoyageTitle: "Reykjavík", airports: ["KEF"], lat: 64.1466, lon: -21.9426, timeZone: "Atlantic/Reykjavik" },
  ]),
  ...group("TR", "Türkiye", "Europe", [
    { code: "IST", name: "Istanbul", airports: ["IST", "SAW"], lat: 41.0082, lon: 28.9784, timeZone: "Europe/Istanbul" },
  ]),
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

/** The IATA code to use when searching flights to or from a city. */
export function flightCodeOf(city: City): string {
  return city.flightCode ?? city.code;
}

export const HOME_CITIES = CITIES.filter((c) => c.country === "US");
export const DESTINATION_CITIES = CITIES.filter((c) => c.country !== "US");

export const REGION_ORDER: Region[] = ["East Asia", "Southeast Asia", "Europe", "Middle East", "North America"];
