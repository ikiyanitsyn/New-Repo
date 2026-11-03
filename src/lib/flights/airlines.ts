const NAMES: Record<string, string> = {
  CA: "Air China", MU: "China Eastern", CZ: "China Southern", HU: "Hainan Airlines", FM: "Shanghai Airlines",
  "3U": "Sichuan Airlines", ZH: "Shenzhen Airlines", MF: "Xiamen Air", HO: "Juneyao Air", CX: "Cathay Pacific",
  UO: "HK Express", HX: "Hong Kong Airlines", UA: "United", DL: "Delta", AA: "American", AS: "Alaska",
  B6: "JetBlue", KE: "Korean Air", OZ: "Asiana", NH: "ANA", JL: "Japan Airlines", SQ: "Singapore Airlines",
  TG: "Thai Airways", TK: "Turkish Airlines", BA: "British Airways", VS: "Virgin Atlantic", AF: "Air France",
  KL: "KLM", LH: "Lufthansa", LX: "SWISS", AZ: "ITA Airways", IB: "Iberia", VY: "Vueling", EK: "Emirates",
  QR: "Qatar Airways", EY: "Etihad", AC: "Air Canada", BR: "EVA Air", CI: "China Airlines", PR: "Philippine Airlines",
  VN: "Vietnam Airlines", MH: "Malaysia Airlines", FR: "Ryanair", U2: "easyJet", ZG: "ZIPAIR", TR: "Scoot",
};

export function airlineName(code: string): string {
  return NAMES[code] ?? code;
}
