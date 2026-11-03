import { getCity } from "../cities";
import type { FlightQuery } from "./types";

const CABIN_SKYSCANNER = { economy: "economy", premium: "premiumeconomy", business: "business", first: "first" } as const;

/** Deep links to big search sites so travellers can verify and book. */
export function searchLinks(q: FlightQuery): { label: string; url: string }[] {
  const from = getCity(q.from);
  const to = getCity(q.to);
  const [y, m, d] = q.date.split("-");
  const yymmdd = `${y.slice(2)}${m}${d}`;
  const gf = `Flights to ${to.airports[0]} from ${from.airports[0]} on ${q.date} one way ${q.adults} adult${q.adults > 1 ? "s" : ""} ${q.cabin === "premium" ? "premium economy" : q.cabin}${q.directOnly ? " nonstop" : ""}`;
  return [
    { label: "Google Flights", url: `https://www.google.com/travel/flights?q=${encodeURIComponent(gf)}` },
    {
      label: "Skyscanner",
      url: `https://www.skyscanner.com/transport/flights/${q.from.toLowerCase()}/${q.to.toLowerCase()}/${yymmdd}/?adultsv2=${q.adults}&cabinclass=${CABIN_SKYSCANNER[q.cabin]}${q.directOnly ? "&preferdirects=true" : ""}`,
    },
    { label: "Kiwi.com", url: "https://www.kiwi.com/en/" },
  ];
}
