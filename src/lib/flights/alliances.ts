/**
 * A small static airline -> alliance map (membership as of 2026; it changes
 * rarely). Keyed by the airline name as the providers show it, with IATA
 * codes as a second key because Travelpayouts gives codes.
 */
export type Alliance = "Star Alliance" | "oneworld" | "SkyTeam";

const STAR: string[] = [
  "Air Canada", "AC", "Air China", "CA", "Air India", "AI", "Air New Zealand", "NZ", "ANA", "NH", "Asiana", "OZ",
  "Austrian", "OS", "Avianca", "AV", "Brussels Airlines", "SN", "Copa Airlines", "CM", "Croatia Airlines", "OU",
  "EgyptAir", "MS", "Ethiopian", "ET", "EVA Air", "BR", "LOT Polish Airlines", "LO", "Lufthansa", "LH",
  "Scandinavian Airlines", "SAS", "SK", "Shenzhen Airlines", "ZH", "Singapore Airlines", "SQ", "South African Airways", "SA",
  "SWISS", "LX", "TAP Air Portugal", "TP", "Thai Airways", "TG", "Turkish Airlines", "TK", "United", "UA",
];
const ONEWORLD: string[] = [
  "Alaska", "AS", "American", "AA", "British Airways", "BA", "Cathay Pacific", "CX", "Finnair", "AY", "Iberia", "IB",
  "Japan Airlines", "JL", "Malaysia Airlines", "MH", "Oman Air", "WY", "Qantas", "QF", "Qatar Airways", "QR",
  "Royal Air Maroc", "AT", "Royal Jordanian", "RJ", "SriLankan Airlines", "UL", "Fiji Airways", "FJ",
];
const SKYTEAM: string[] = [
  "Aeroméxico", "Aeromexico", "AM", "Air Europa", "UX", "Air France", "AF", "China Airlines", "CI", "China Eastern", "MU",
  "Delta", "DL", "Garuda Indonesia", "GA", "ITA Airways", "AZ", "Kenya Airways", "KQ", "KLM", "KL", "Korean Air", "KE",
  "Middle East Airlines", "ME", "Saudia", "SV", "TAROM", "RO", "Vietnam Airlines", "VN", "Xiamen Air", "MF", "Aerolíneas Argentinas", "AR",
];

const MAP = new Map<string, Alliance>();
for (const [list, a] of [[STAR, "Star Alliance"], [ONEWORLD, "oneworld"], [SKYTEAM, "SkyTeam"]] as const) {
  for (const k of list) MAP.set(k.toLowerCase(), a);
}

/** The alliance an airline belongs to, or null (independent or unknown). Accepts a name or an IATA code. */
export function airlineAlliance(nameOrCode: string): Alliance | null {
  return MAP.get(nameOrCode.trim().toLowerCase()) ?? null;
}

/** One alliance label for an itinerary: only when every carrier is in the same alliance. */
export function offerAlliance(airlines: string[]): Alliance | null {
  if (airlines.length === 0) return null;
  const set = new Set(airlines.map(airlineAlliance));
  if (set.size !== 1) return null;
  return [...set][0];
}
