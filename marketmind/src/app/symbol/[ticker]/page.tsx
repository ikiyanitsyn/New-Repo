import type { Metadata } from "next";
import SymbolView from "@/components/SymbolView";
import { instrumentFor, normalizeSymbol } from "@/lib/universe";

type Props = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const inst = instrumentFor(decodeURIComponent(ticker));
  return { title: `${inst.name === inst.symbol ? inst.symbol : `${inst.name} (${inst.symbol.replace("^", "")})`} · MarketMind` };
}

export default async function Page({ params }: Props) {
  const { ticker } = await params;
  const symbol = normalizeSymbol(decodeURIComponent(ticker));
  return <SymbolView key={symbol} symbol={symbol} />;
}
