const NAMES: Record<string, string> = {
  CA: "Air China", MU: "China Eastern", CZ: "China Southern", HU: "Hainan Airlines", FM: "Shanghai Airlines",
  "3U": "Sichuan Airlines", ZH: "Shenzhen Airlines", MF: "Xiamen Air", HO: "Juneyao Air", CX: "Cathay Pacific",
  UO: "HK Express", HX: "Hong Kong Airlines", UA: "United", DL: "Delta", AA: "American", AS: "Alaska",
  B6: "JetBlue", KE: "Korean Air", OZ: "Asiana", NH: "ANA", JL: "Japan Airlines", SQ: "Singapore Airlines",
  TG: "Thai Airways", TK: "Turkish Airlines", BA: "British Airways", VS: "Virgin Atlantic", AF: "Air France",
  KL: "KLM", LH: "Lufthansa", LX: "SWISS", AZ: "ITA Airways", IB: "Iberia", VY: "Vueling", EK: "Emirates",
  QR: "Qatar Airways", EY: "Etihad", AC: "Air Canada", BR: "EVA Air", CI: "China Airlines", PR: "Philippine Airlines",
  VN: "Vietnam Airlines", MH: "Malaysia Airlines", FR: "Ryanair", U2: "easyJet", ZG: "ZIPAIR", TR: "Scoot",
  AI: "Air India", FI: "Icelandair", AY: "Finnair", TP: "TAP Air Portugal", SK: "SAS", LO: "LOT Polish", OS: "Austrian",
  SN: "Brussels Airlines", EI: "Aer Lingus", DY: "Norwegian", WS: "WestJet", AM: "Aeromexico", ET: "Ethiopian", MS: "Egyptair",
  SV: "Saudia", WY: "Oman Air", GF: "Gulf Air", KU: "Kuwait Airways", RJ: "Royal Jordanian", AT: "Royal Air Maroc", LY: "El Al",
  HA: "Hawaiian", F9: "Frontier", NK: "Spirit", WN: "Southwest", GA: "Garuda Indonesia", "5J": "Cebu Pacific", VJ: "VietJet",
  AK: "AirAsia", D7: "AirAsia X", MM: "Peach", "7C": "Jeju Air", TW: "T'way Air", LJ: "Jin Air", QF: "Qantas", NZ: "Air New Zealand",
  FJ: "Fiji Airways", UL: "SriLankan", PG: "Bangkok Airways", JX: "Starlux", MR: "Hunnu Air", OM: "MIAT Mongolian", UX: "Air Europa",
  A3: "Aegean", PC: "Pegasus", W6: "Wizz Air", BT: "airBaltic", OU: "Croatia Airlines", JU: "Air Serbia", RO: "TAROM", "9C": "Spring Airlines",
};

export function airlineName(code: string): string {
  return NAMES[code] ?? code;
}
