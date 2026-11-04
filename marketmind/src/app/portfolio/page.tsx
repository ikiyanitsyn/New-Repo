import type { Metadata } from "next";
import PortfolioView from "@/components/PortfolioView";

export const metadata: Metadata = { title: "Paper Portfolio · MarketMind" };

export default function Page() {
  return <PortfolioView />;
}
