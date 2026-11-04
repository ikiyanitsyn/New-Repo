import { searchUniverse, normalizeSymbol } from "@/lib/universe";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = searchUniverse(q).map((i) => ({ symbol: i.symbol, name: i.name, cls: i.cls }));
  const sym = normalizeSymbol(q);
  // Let people open any ticker, even one MarketMind doesn't list.
  if (sym && sym.length <= 6 && !results.some((r) => r.symbol === sym)) results.push({ symbol: sym, name: "Look up ticker", cls: "stock" });
  return Response.json({ results });
}
