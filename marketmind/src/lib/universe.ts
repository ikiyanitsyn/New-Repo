import type { Instrument } from "./types";

/**
 * The instruments MarketMind follows out of the box. Any other ticker can be looked up
 * on demand; these are the ones the dashboard, screener and news engine know about.
 */
export const INDICES: Instrument[] = [
  { symbol: "^GSPC", name: "S&P 500", cls: "index", sector: "Broad Market", region: "US", aliases: ["S&P 500", "S&P", "Wall Street"], beta: 1 },
  { symbol: "^IXIC", name: "Nasdaq Composite", cls: "index", sector: "Technology", region: "US", aliases: ["Nasdaq"], beta: 1.2 },
  { symbol: "^DJI", name: "Dow Jones Industrial Average", cls: "index", sector: "Broad Market", region: "US", aliases: ["Dow", "Dow Jones"], beta: 0.9 },
  { symbol: "^RUT", name: "Russell 2000", cls: "index", sector: "Broad Market", region: "US", aliases: ["Russell 2000", "small caps", "small-cap"], beta: 1.25 },
  { symbol: "^VIX", name: "CBOE Volatility Index", cls: "index", sector: "Volatility", region: "US", aliases: ["VIX", "volatility index", "fear gauge"], beta: -4 },
  { symbol: "^FTSE", name: "FTSE 100", cls: "index", sector: "International", region: "Europe", aliases: ["FTSE"], beta: 0.7 },
  { symbol: "^GDAXI", name: "DAX", cls: "index", sector: "International", region: "Europe", aliases: ["DAX", "German stocks"], beta: 0.9 },
  { symbol: "^N225", name: "Nikkei 225", cls: "index", sector: "International", region: "Japan", aliases: ["Nikkei", "Japanese stocks"], beta: 0.8 },
  { symbol: "^HSI", name: "Hang Seng", cls: "index", sector: "International", region: "China", aliases: ["Hang Seng", "Hong Kong stocks"], beta: 0.8 },
];

export const ETFS: Instrument[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", cls: "etf", sector: "Broad Market", region: "US", beta: 1 },
  { symbol: "QQQ", name: "Invesco QQQ (Nasdaq-100)", cls: "etf", sector: "Technology", region: "US", beta: 1.2 },
  { symbol: "DIA", name: "SPDR Dow Jones ETF", cls: "etf", sector: "Broad Market", region: "US", beta: 0.9 },
  { symbol: "IWM", name: "iShares Russell 2000", cls: "etf", sector: "Broad Market", region: "US", beta: 1.25 },
  { symbol: "VTI", name: "Vanguard Total Stock Market", cls: "etf", sector: "Broad Market", region: "US", beta: 1 },
  { symbol: "XLK", name: "Technology Select Sector", cls: "etf", sector: "Technology", region: "US", beta: 1.2 },
  { symbol: "SMH", name: "VanEck Semiconductor", cls: "etf", sector: "Semiconductors", region: "Global", aliases: ["chipmakers", "chip stocks", "semiconductor"], beta: 1.5 },
  { symbol: "XLF", name: "Financial Select Sector", cls: "etf", sector: "Financials", region: "US", aliases: ["banks", "bank stocks"], beta: 1.1 },
  { symbol: "XLE", name: "Energy Select Sector", cls: "etf", sector: "Energy", region: "US", aliases: ["energy stocks", "oil stocks"], beta: 0.9 },
  { symbol: "XLV", name: "Health Care Select Sector", cls: "etf", sector: "Health Care", region: "US", aliases: ["healthcare stocks", "drugmakers", "pharma"], beta: 0.7 },
  { symbol: "XLY", name: "Consumer Discretionary Select", cls: "etf", sector: "Consumer Discretionary", region: "US", aliases: ["retailers", "consumer spending"], beta: 1.15 },
  { symbol: "XLP", name: "Consumer Staples Select", cls: "etf", sector: "Consumer Staples", region: "US", beta: 0.6 },
  { symbol: "XLI", name: "Industrial Select Sector", cls: "etf", sector: "Industrials", region: "US", aliases: ["industrials", "manufacturers"], beta: 1.05 },
  { symbol: "XLU", name: "Utilities Select Sector", cls: "etf", sector: "Utilities", region: "US", aliases: ["utilities"], beta: 0.5 },
  { symbol: "XLRE", name: "Real Estate Select Sector", cls: "etf", sector: "Real Estate", region: "US", aliases: ["real estate", "REITs", "housing"], beta: 0.9 },
  { symbol: "XLB", name: "Materials Select Sector", cls: "etf", sector: "Materials", region: "US", aliases: ["miners", "steel", "materials"], beta: 1 },
  { symbol: "ITA", name: "iShares US Aerospace & Defense", cls: "etf", sector: "Defense", region: "US", aliases: ["defense stocks", "defence", "defense contractors"], beta: 0.9 },
  { symbol: "JETS", name: "US Global Jets (Airlines)", cls: "etf", sector: "Industrials", region: "US", aliases: ["airlines", "airline stocks"], beta: 1.3 },
  { symbol: "TLT", name: "iShares 20+ Year Treasury", cls: "etf", sector: "Bonds", region: "US", aliases: ["Treasuries", "Treasury yields", "bonds", "bond yields"], beta: -0.2 },
  { symbol: "HYG", name: "iShares High Yield Corporate Bond", cls: "etf", sector: "Bonds", region: "US", aliases: ["junk bonds", "high-yield", "credit spreads"], beta: 0.4 },
  { symbol: "GLD", name: "SPDR Gold Shares", cls: "etf", sector: "Commodities", region: "Global", aliases: ["gold", "bullion"], beta: 0.05 },
  { symbol: "SLV", name: "iShares Silver Trust", cls: "etf", sector: "Commodities", region: "Global", aliases: ["silver"], beta: 0.3 },
  { symbol: "USO", name: "United States Oil Fund", cls: "etf", sector: "Commodities", region: "Global", aliases: ["oil", "crude", "Brent", "WTI", "oil prices"], beta: 0.5 },
  { symbol: "UNG", name: "United States Natural Gas", cls: "etf", sector: "Commodities", region: "Global", aliases: ["natural gas", "LNG"], beta: 0.2 },
  { symbol: "WEAT", name: "Teucrium Wheat Fund", cls: "etf", sector: "Commodities", region: "Global", aliases: ["wheat", "grain"], beta: 0.1 },
  { symbol: "UUP", name: "Invesco US Dollar Index", cls: "etf", sector: "Commodities", region: "US", aliases: ["dollar", "greenback", "U.S. dollar"], beta: -0.2 },
  { symbol: "EEM", name: "iShares MSCI Emerging Markets", cls: "etf", sector: "International", region: "Emerging", aliases: ["emerging markets"], beta: 1 },
  { symbol: "FXI", name: "iShares China Large-Cap", cls: "etf", sector: "International", region: "China", aliases: ["Chinese stocks", "China stocks"], beta: 0.9 },
  { symbol: "VGK", name: "Vanguard FTSE Europe", cls: "etf", sector: "International", region: "Europe", aliases: ["European stocks", "Europe stocks"], beta: 0.9 },
  { symbol: "EWJ", name: "iShares MSCI Japan", cls: "etf", sector: "International", region: "Japan", aliases: ["Japan stocks"], beta: 0.7 },
  { symbol: "EWT", name: "iShares MSCI Taiwan", cls: "etf", sector: "International", region: "Asia", aliases: ["Taiwan stocks"], beta: 1.1 },
  { symbol: "IBIT", name: "iShares Bitcoin Trust", cls: "etf", sector: "Crypto", region: "Global", aliases: ["bitcoin", "crypto", "cryptocurrency"], beta: 1.8 },
];

export const STOCKS: Instrument[] = [
  { symbol: "AAPL", name: "Apple", cls: "stock", sector: "Technology", region: "US", aliases: ["Apple", "iPhone"], beta: 1.2 },
  { symbol: "MSFT", name: "Microsoft", cls: "stock", sector: "Technology", region: "US", aliases: ["Microsoft"], beta: 1.1 },
  { symbol: "NVDA", name: "Nvidia", cls: "stock", sector: "Semiconductors", region: "US", aliases: ["Nvidia", "NVIDIA"], beta: 1.8 },
  { symbol: "AMZN", name: "Amazon", cls: "stock", sector: "Consumer Discretionary", region: "US", aliases: ["Amazon"], beta: 1.3 },
  { symbol: "GOOGL", name: "Alphabet", cls: "stock", sector: "Communication", region: "US", aliases: ["Alphabet", "Google"], beta: 1.1 },
  { symbol: "META", name: "Meta Platforms", cls: "stock", sector: "Communication", region: "US", aliases: ["Meta", "Facebook", "Instagram"], beta: 1.3 },
  { symbol: "TSLA", name: "Tesla", cls: "stock", sector: "Consumer Discretionary", region: "US", aliases: ["Tesla", "Elon Musk", "Musk"], beta: 2 },
  { symbol: "AVGO", name: "Broadcom", cls: "stock", sector: "Semiconductors", region: "US", aliases: ["Broadcom"], beta: 1.4 },
  { symbol: "TSM", name: "Taiwan Semiconductor", cls: "stock", sector: "Semiconductors", region: "Asia", aliases: ["TSMC", "Taiwan Semiconductor"], beta: 1.3 },
  { symbol: "AMD", name: "Advanced Micro Devices", cls: "stock", sector: "Semiconductors", region: "US", aliases: ["AMD"], beta: 1.7 },
  { symbol: "JPM", name: "JPMorgan Chase", cls: "stock", sector: "Financials", region: "US", aliases: ["JPMorgan", "JP Morgan"], beta: 1.1 },
  { symbol: "GS", name: "Goldman Sachs", cls: "stock", sector: "Financials", region: "US", aliases: ["Goldman"], beta: 1.3 },
  { symbol: "BRK-B", name: "Berkshire Hathaway", cls: "stock", sector: "Financials", region: "US", aliases: ["Berkshire"], beta: 0.85 },
  { symbol: "XOM", name: "Exxon Mobil", cls: "stock", sector: "Energy", region: "US", aliases: ["Exxon"], beta: 0.9 },
  { symbol: "CVX", name: "Chevron", cls: "stock", sector: "Energy", region: "US", aliases: ["Chevron"], beta: 0.9 },
  { symbol: "LMT", name: "Lockheed Martin", cls: "stock", sector: "Defense", region: "US", aliases: ["Lockheed"], beta: 0.5 },
  { symbol: "RTX", name: "RTX (Raytheon)", cls: "stock", sector: "Defense", region: "US", aliases: ["Raytheon", "RTX"], beta: 0.7 },
  { symbol: "BA", name: "Boeing", cls: "stock", sector: "Industrials", region: "US", aliases: ["Boeing"], beta: 1.4 },
  { symbol: "CAT", name: "Caterpillar", cls: "stock", sector: "Industrials", region: "US", aliases: ["Caterpillar"], beta: 1.1 },
  { symbol: "UNH", name: "UnitedHealth", cls: "stock", sector: "Health Care", region: "US", aliases: ["UnitedHealth"], beta: 0.6 },
  { symbol: "LLY", name: "Eli Lilly", cls: "stock", sector: "Health Care", region: "US", aliases: ["Eli Lilly", "Lilly"], beta: 0.5 },
  { symbol: "JNJ", name: "Johnson & Johnson", cls: "stock", sector: "Health Care", region: "US", aliases: ["Johnson & Johnson"], beta: 0.5 },
  { symbol: "WMT", name: "Walmart", cls: "stock", sector: "Consumer Staples", region: "US", aliases: ["Walmart"], beta: 0.5 },
  { symbol: "KO", name: "Coca-Cola", cls: "stock", sector: "Consumer Staples", region: "US", aliases: ["Coca-Cola"], beta: 0.6 },
  { symbol: "COST", name: "Costco", cls: "stock", sector: "Consumer Staples", region: "US", aliases: ["Costco"], beta: 0.8 },
  { symbol: "NKE", name: "Nike", cls: "stock", sector: "Consumer Discretionary", region: "US", aliases: ["Nike"], beta: 1.1 },
  { symbol: "DAL", name: "Delta Air Lines", cls: "stock", sector: "Industrials", region: "US", aliases: ["Delta Air"], beta: 1.3 },
  { symbol: "NEE", name: "NextEra Energy", cls: "stock", sector: "Utilities", region: "US", aliases: ["NextEra"], beta: 0.6 },
  { symbol: "FCX", name: "Freeport-McMoRan", cls: "stock", sector: "Materials", region: "US", aliases: ["Freeport", "copper"], beta: 1.6 },
  { symbol: "COIN", name: "Coinbase", cls: "stock", sector: "Crypto", region: "US", aliases: ["Coinbase"], beta: 2.5 },
];

export const UNIVERSE: Instrument[] = [...INDICES, ...ETFS, ...STOCKS];

const BY_SYMBOL = new Map(UNIVERSE.map((i) => [i.symbol, i]));

/** The sector ETF that best stands in for a sector, so sector news can reach single stocks. */
export const SECTOR_PROXY: Partial<Record<Instrument["sector"], string>> = {
  "Broad Market": "SPY",
  Technology: "XLK",
  Semiconductors: "SMH",
  Communication: "XLK",
  "Consumer Discretionary": "XLY",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  Financials: "XLF",
  "Health Care": "XLV",
  Industrials: "XLI",
  Defense: "ITA",
  Materials: "XLB",
  Utilities: "XLU",
  "Real Estate": "XLRE",
  Crypto: "IBIT",
};

/** Index symbols map onto the ETF that tracks them, which is where the news engine scores impacts. */
export const INDEX_PROXY: Record<string, string> = {
  "^GSPC": "SPY",
  "^IXIC": "QQQ",
  "^DJI": "DIA",
  "^RUT": "IWM",
  "^FTSE": "VGK",
  "^GDAXI": "VGK",
  "^N225": "EWJ",
  "^HSI": "FXI",
};

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\./g, "-").replace(/[^A-Z0-9^\-=]/g, "").slice(0, 12);
}

export function findInstrument(symbol: string): Instrument | undefined {
  return BY_SYMBOL.get(normalizeSymbol(symbol));
}

/** Known instrument, or a generic stock entry for a ticker the app hasn't seen before. */
export function instrumentFor(symbol: string): Instrument {
  const s = normalizeSymbol(symbol);
  return (
    BY_SYMBOL.get(s) ?? {
      symbol: s,
      name: s,
      cls: s.startsWith("^") ? "index" : "stock",
      sector: "Broad Market",
      region: "US",
      beta: 1,
    }
  );
}

export function searchUniverse(q: string, limit = 8): Instrument[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const scored = UNIVERSE.map((i) => {
    const sym = i.symbol.toLowerCase().replace("^", "");
    const name = i.name.toLowerCase();
    let score = 0;
    if (sym === needle) score = 100;
    else if (sym.startsWith(needle)) score = 80;
    else if (name.startsWith(needle)) score = 60;
    else if (name.includes(needle)) score = 40;
    else if (i.aliases?.some((a) => a.toLowerCase().includes(needle))) score = 20;
    return { i, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.i);
}

/** Approximate price levels used only to anchor sample data when live prices are unreachable. */
export const SAMPLE_ANCHORS: Record<string, { price: number; vol: number; drift: number }> = {
  "^GSPC": { price: 6850, vol: 0.16, drift: 0.1 },
  "^IXIC": { price: 23400, vol: 0.21, drift: 0.13 },
  "^DJI": { price: 47200, vol: 0.14, drift: 0.08 },
  "^RUT": { price: 2480, vol: 0.22, drift: 0.06 },
  "^VIX": { price: 17, vol: 0.9, drift: 0 },
  "^FTSE": { price: 9700, vol: 0.13, drift: 0.07 },
  "^GDAXI": { price: 24100, vol: 0.17, drift: 0.09 },
  "^N225": { price: 50500, vol: 0.2, drift: 0.12 },
  "^HSI": { price: 26300, vol: 0.24, drift: 0.1 },
  SPY: { price: 683, vol: 0.16, drift: 0.1 },
  QQQ: { price: 620, vol: 0.21, drift: 0.13 },
  DIA: { price: 472, vol: 0.14, drift: 0.08 },
  IWM: { price: 246, vol: 0.22, drift: 0.06 },
  VTI: { price: 335, vol: 0.16, drift: 0.1 },
  XLK: { price: 290, vol: 0.22, drift: 0.14 },
  SMH: { price: 345, vol: 0.32, drift: 0.2 },
  XLF: { price: 53, vol: 0.17, drift: 0.08 },
  XLE: { price: 90, vol: 0.24, drift: 0.02 },
  XLV: { price: 145, vol: 0.14, drift: 0.03 },
  XLY: { price: 238, vol: 0.2, drift: 0.07 },
  XLP: { price: 79, vol: 0.12, drift: 0.02 },
  XLI: { price: 152, vol: 0.17, drift: 0.09 },
  XLU: { price: 86, vol: 0.16, drift: 0.08 },
  XLRE: { price: 42, vol: 0.18, drift: 0.02 },
  XLB: { price: 89, vol: 0.18, drift: 0.03 },
  ITA: { price: 205, vol: 0.18, drift: 0.15 },
  JETS: { price: 26, vol: 0.32, drift: 0.04 },
  TLT: { price: 90, vol: 0.15, drift: -0.01 },
  HYG: { price: 80.5, vol: 0.06, drift: 0.02 },
  GLD: { price: 370, vol: 0.18, drift: 0.2 },
  SLV: { price: 44, vol: 0.3, drift: 0.2 },
  USO: { price: 72, vol: 0.32, drift: -0.02 },
  UNG: { price: 13, vol: 0.55, drift: -0.05 },
  WEAT: { price: 4.4, vol: 0.28, drift: -0.05 },
  UUP: { price: 27.5, vol: 0.07, drift: -0.02 },
  EEM: { price: 54, vol: 0.18, drift: 0.12 },
  FXI: { price: 40, vol: 0.27, drift: 0.12 },
  VGK: { price: 80, vol: 0.15, drift: 0.1 },
  EWJ: { price: 80, vol: 0.16, drift: 0.09 },
  EWT: { price: 64, vol: 0.25, drift: 0.12 },
  IBIT: { price: 62, vol: 0.5, drift: 0.15 },
  AAPL: { price: 268, vol: 0.26, drift: 0.1 },
  MSFT: { price: 515, vol: 0.24, drift: 0.12 },
  NVDA: { price: 198, vol: 0.45, drift: 0.25 },
  AMZN: { price: 245, vol: 0.31, drift: 0.12 },
  GOOGL: { price: 280, vol: 0.3, drift: 0.18 },
  META: { price: 690, vol: 0.36, drift: 0.12 },
  TSLA: { price: 445, vol: 0.6, drift: 0.1 },
  AVGO: { price: 360, vol: 0.42, drift: 0.22 },
  TSM: { price: 300, vol: 0.36, drift: 0.2 },
  AMD: { price: 250, vol: 0.5, drift: 0.2 },
  JPM: { price: 310, vol: 0.22, drift: 0.12 },
  GS: { price: 800, vol: 0.27, drift: 0.14 },
  "BRK-B": { price: 495, vol: 0.16, drift: 0.07 },
  XOM: { price: 115, vol: 0.22, drift: 0.02 },
  CVX: { price: 155, vol: 0.23, drift: 0.02 },
  LMT: { price: 490, vol: 0.2, drift: 0.04 },
  RTX: { price: 175, vol: 0.21, drift: 0.14 },
  BA: { price: 215, vol: 0.34, drift: 0.05 },
  CAT: { price: 560, vol: 0.28, drift: 0.14 },
  UNH: { price: 345, vol: 0.38, drift: -0.05 },
  LLY: { price: 860, vol: 0.32, drift: 0.12 },
  JNJ: { price: 190, vol: 0.16, drift: 0.08 },
  WMT: { price: 103, vol: 0.2, drift: 0.12 },
  KO: { price: 69, vol: 0.14, drift: 0.04 },
  COST: { price: 915, vol: 0.2, drift: 0.06 },
  NKE: { price: 66, vol: 0.34, drift: -0.04 },
  DAL: { price: 58, vol: 0.38, drift: 0.04 },
  NEE: { price: 84, vol: 0.24, drift: 0.08 },
  FCX: { price: 42, vol: 0.4, drift: 0.04 },
  COIN: { price: 330, vol: 0.7, drift: 0.12 },
};
