import type { Metadata } from "next";
import NewsView from "@/components/NewsView";

export const metadata: Metadata = { title: "News & Geopolitics · MarketMind" };

export default function Page() {
  return <NewsView />;
}
