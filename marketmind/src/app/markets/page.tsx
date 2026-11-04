import type { Metadata } from "next";
import Screener from "@/components/Screener";

export const metadata: Metadata = { title: "Markets · MarketMind" };

export default function Page() {
  return <Screener />;
}
