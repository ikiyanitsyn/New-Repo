import type { Metadata } from "next";
import { ShareClient } from "@/components/cloud/ShareClient";

export const metadata: Metadata = {
  title: "Shared itinerary · Intercontinental Nomad",
  description: "A trip itinerary shared with you: day by day, flights, stays and what to sort out before you go.",
  // Shared trips are private links; keep them out of search engines.
  robots: { index: false, follow: false },
};

export default function SharePage() {
  return <ShareClient />;
}
