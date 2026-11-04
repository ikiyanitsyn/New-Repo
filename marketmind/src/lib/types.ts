export type AssetClass = "index" | "etf" | "stock";

export type Sector =
  | "Broad Market"
  | "Technology"
  | "Semiconductors"
  | "Communication"
  | "Consumer Discretionary"
  | "Consumer Staples"
  | "Energy"
  | "Financials"
  | "Health Care"
  | "Industrials"
  | "Defense"
  | "Materials"
  | "Utilities"
  | "Real Estate"
  | "Bonds"
  | "Commodities"
  | "International"
  | "Volatility"
  | "Crypto";

export interface Instrument {
  symbol: string;
  name: string;
  cls: AssetClass;
  sector: Sector;
  /** Region the instrument mostly tracks, for geopolitical exposure. */
  region: "US" | "Europe" | "Asia" | "China" | "Japan" | "Emerging" | "Global";
  /** Words in a headline that mean this instrument is being talked about. */
  aliases?: string[];
  /** Rough beta to the S&P 500, used to pass market-wide news through to single names. */
  beta?: number;
}

export interface Bar {
  t: number; // epoch ms (market close)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type DataSource = "yahoo" | "stooq" | "sample";

export interface Series {
  symbol: string;
  bars: Bar[];
  source: DataSource;
  currency: string;
  fetchedAt: number;
}

export type TrendState = "strong-up" | "up" | "sideways" | "down" | "strong-down";

export interface Technicals {
  last: number;
  change1d: number; // fraction
  change5d: number;
  change1m: number;
  change3m: number;
  changeYtd: number;
  change1y: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: { macd: number; signal: number; hist: number } | null;
  bollinger: { upper: number; middle: number; lower: number; pctB: number } | null;
  atr14: number | null;
  volAnnual: number; // annualised stdev of daily log returns (60d)
  high52: number;
  low52: number;
  trend: TrendState;
  trendScore: number; // -100..100
  support: number | null;
  resistance: number | null;
  signals: string[];
}

export interface Quote {
  instrument: Instrument;
  technicals: Technicals;
  spark: number[]; // last ~60 closes
  source: DataSource;
}

// ---- News ----

export interface NewsSource {
  id: string;
  name: string;
  short: string;
  homepage: string;
  domain: string;
  feeds: string[];
}

export interface Article {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  summary: string;
  url: string | null;
  published: number;
  sample: boolean;
}

export type Direction = 1 | -1;

export interface ImpactTarget {
  symbol: string;
  direction: Direction;
  weight: number; // 0..1 sensitivity
  why: string;
}

export interface ThemeHit {
  themeId: string;
  label: string;
  geopolitical: boolean;
  polarity: Direction; // which way the theme's impacts point for this article
  matched: string[];
}

export interface AnalyzedArticle extends Article {
  themes: ThemeHit[];
  sentiment: number; // -1..1
  severity: number; // 0..1
  tickers: string[]; // explicitly mentioned instruments
  impacts: { symbol: string; score: number; why: string }[]; // signed, already severity-scaled
  regions: string[];
}

export interface ThemeSummary {
  themeId: string;
  label: string;
  geopolitical: boolean;
  articles: number;
  heat: number; // 0..100
  netPolarity: number; // -1..1
  topImpacts: { symbol: string; score: number }[];
  headlines: { title: string; source: string; url: string | null }[];
  explainer: string;
}

export interface GeoRisk {
  index: number; // 0..100
  label: "Calm" | "Guarded" | "Elevated" | "High" | "Severe";
  drivers: { label: string; heat: number }[];
  regions: { region: string; heat: number }[];
}

export interface NewsDigest {
  articles: AnalyzedArticle[];
  themes: ThemeSummary[];
  geoRisk: GeoRisk;
  sentiment: number;
  sources: { id: string; name: string; status: "live" | "unavailable"; count: number }[];
  sample: boolean;
  fetchedAt: number;
}

// ---- Outlook ----

export interface Scenario {
  name: "Bull" | "Base" | "Bear";
  probability: number;
  target: number;
  move: number; // fraction
  narrative: string;
}

export interface Driver {
  label: string;
  impact: number; // signed contribution to score
  kind: "technical" | "news" | "macro";
}

export interface Outlook {
  symbol: string;
  horizonDays: number;
  score: number; // -100..100
  stance: "Strong Bullish" | "Bullish" | "Neutral" | "Bearish" | "Strong Bearish";
  probUp: number; // 0..1
  expectedMove: number; // 1-sigma fraction over horizon
  confidence: number; // 0..1
  technicalScore: number;
  newsScore: number;
  drivers: Driver[];
  scenarios: Scenario[];
  summary: string;
}

// ---- Advisors ----

export type TradeAction = "buy" | "sell" | "short" | "buy-calls" | "buy-puts" | "margin-buy" | "dca" | "hold";

export interface TradeIdea {
  symbol: string;
  action: TradeAction;
  amount: number; // dollars
  horizon: "days" | "weeks" | "months" | "years";
  thesis: string;
  portfolioPct?: number; // share of investor's portfolio
  hasEmergencyFund?: boolean;
  hasDebt?: boolean;
}

export interface DebateEvent {
  type: "meta" | "turn_start" | "delta" | "turn_end" | "verdict" | "error" | "done";
  advisorId?: string;
  round?: number;
  text?: string;
  stance?: number;
  verdict?: DebateVerdict;
  mode?: "ai" | "offline";
}

export interface DebateVerdict {
  consensus: "Strongly For" | "Lean For" | "Split" | "Lean Against" | "Strongly Against";
  score: number; // -2..2 average
  votes: { advisorId: string; stance: number; oneLiner: string }[];
  keyRisks: string[];
  keyCatalysts: string[];
  saferAlternative: string;
  summary: string;
}
