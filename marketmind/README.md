# MarketMind

A market-intelligence and paper-trading app. It follows the trends of stocks, ETFs and indexes and reads the day's geopolitical and economic news from five major market news services. It works out how each story is likely to move prices and turns that into speculative outlooks. A roundtable of AI advisor personas, Dave Ramsey among them, can then debate any trade you're considering.

> **Not financial advice.** Outlooks are speculative model output. The advisor personas are AI simulations of publicly known investing philosophies; they are not the real people and are not endorsed by them. Paper trading uses virtual money.

## Quick start

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
cd marketmind
npm install
npm run dev
```

Open <http://localhost:3000>.

The app works straight away with no keys: live prices come from Yahoo Finance (with Stooq as a backup), live headlines come from the five services' public RSS feeds, and the analysis, outlooks and debates run on MarketMind's built-in engine.

### Turn on Claude (recommended)

Claude powers **Deep Research**: live web search restricted to the five services, a written brief per ticker, and the daily market brief. It also makes the **Advisor Roundtable** a real, free-flowing debate.

1. Get an API key at <https://platform.claude.com/> → API keys.
2. Create `marketmind/.env.local`:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   # optional, defaults to claude-opus-5-5
   MARKETMIND_MODEL=claude-opus-5-5
   ```

3. Restart `npm run dev`. The badge in the top bar changes from **◇ Built-in engine** to **✦ Claude AI on**.

If Claude is unreachable, every feature falls back to the built-in engine automatically.

## What's inside

| Page | What it does |
|---|---|
| **Dashboard** | World indexes, S&P 500 one-month outlook, geopolitical risk gauge, the instruments the news is leaning on hardest, sector heatmap (1D/1M/YTD), macro & cross-asset board, market-moving headlines, movers, and an AI market brief. |
| **Markets** | Sortable screener across ~70 indexes, ETFs and stocks: returns, RSI, volatility, trend, news pressure and outlook score. |
| **Ticker page** (`/symbol/NVDA`) | Interactive chart (50/200-day averages, support/resistance, volume, hover detail), full technicals, 1-week / 1-month / 1-quarter outlook with bull/base/bear scenarios and the drivers behind them, how each headline hits it, Deep Research, watchlist and a paper-trade ticket. Any ticker works, not just the listed ones. |
| **News & Geopolitics** | Geopolitical risk index, regions in the news, headline mood, theme cards (Middle East, Russia/Ukraine, China/Taiwan, tariffs, sanctions, export controls, US politics, central banks, inflation, oil, AI spending, credit stress, and more), each explaining how the theme reaches prices and which assets it is pushing now. Filterable feed of every analysed headline. |
| **Advisor Roundtable** | Pitch a trade (ticker, action including options/margin/short, size, horizon, thesis, emergency fund and debt status), pick 2–7 advisors, and watch three rounds: opening statements, rebuttals and a final vote, followed by a moderated verdict with key risks, catalysts and a safer alternative. Save verdicts to your journal. |
| **Paper Portfolio** | $100,000 virtual account, positions with live P&L, allocation bar, watchlist, order history and a trade journal that tracks whether the panel's calls are working out. Stored in your browser. |

**The advisors:** Dave Ramsey, Warren Buffett, Cathie Wood, Ray Dalio, Suze Orman, Jim Cramer and Peter Lynch, each simulated from their publicly stated philosophy.

**The five news services:** Bloomberg, Reuters, The Wall Street Journal, CNBC and Yahoo Finance.

## How the analysis works

- **Trend engine** (`src/lib/market/indicators.ts`): moving averages, RSI, MACD, Bollinger bands, ATR, volatility, golden/death crosses and pivot support/resistance, combined into a trend score from −100 to +100.
- **News impact engine** (`src/lib/analysis/themes.ts`, `newsImpact.ts`): every headline is matched against 21 geopolitical and macro themes. Each theme has a transmission map to specific assets, for example *Strait of Hormuz risk → oil and energy up, airlines down, gold and defense up*. Direction flips for de-escalation (ceasefires, trade deals, dovish or hawkish central banks, hot or cool inflation). Company headlines are scored by tone, and impacts are weighted by severity and recency.
- **Outlook model** (`src/lib/analysis/outlook.ts`): blends trend, mean reversion, momentum, news pressure (direct, sector and market-wide via beta) and the geopolitical backdrop into a stance, a probability of finishing higher (capped at 20–80% on purpose), confidence, and volatility-scaled bull/base/bear targets.
- **Claude** (`src/lib/ai/`): streams research with the web search tool restricted to the five services' domains, plays each persona in the debate, and produces a structured moderator verdict.

## Data notes

- Prices come from Yahoo Finance's public chart API, with Stooq as a fallback. Both are free and may be delayed. If neither can be reached, the app shows clearly labelled **sample data** so you can still explore. Set `MARKETMIND_OFFLINE=1` to force this.
- If no live feed can be reached, the news section shows **illustrative sample headlines**, labelled as such and never attributed to a real outlet.
- Prices are cached for 5 minutes and news for 10 minutes.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run locally with live reload |
| `npm run build` then `npm start` | Production build and server |
| `npm test` | Unit tests (indicators, feed parsing, news impact, outlook, debate engine) |
| `npm run lint` / `npm run typecheck` | Code checks |
