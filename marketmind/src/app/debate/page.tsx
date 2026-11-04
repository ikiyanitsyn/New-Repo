import type { Metadata } from "next";
import DebateView from "@/components/DebateView";
import { normalizeSymbol } from "@/lib/universe";

export const metadata: Metadata = { title: "Advisor Roundtable · MarketMind" };

export default async function Page({ searchParams }: { searchParams: Promise<{ symbol?: string | string[] }> }) {
  const { symbol } = await searchParams;
  const s = typeof symbol === "string" ? normalizeSymbol(symbol) : undefined;
  return <DebateView key={s ?? "default"} initialSymbol={s || undefined} />;
}
