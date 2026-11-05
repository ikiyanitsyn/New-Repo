import type { Metadata } from "next";
import { ItineraryClient } from "@/components/print/ItineraryClient";

export const metadata: Metadata = {
  title: "Itinerary · Intercontinental Nomad",
  description: "Your trip as a printable itinerary: day by day, flights and costs, saved places and what to sort out before you go.",
};

export default function ItineraryPage() {
  return <ItineraryClient />;
}
