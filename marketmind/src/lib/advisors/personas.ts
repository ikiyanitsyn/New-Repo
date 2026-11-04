import type { GeoRisk, Instrument, Outlook, Technicals, TradeIdea } from "../types";

/**
 * AI personas modelled on the publicly stated investing philosophies of well-known financial
 * personalities. They are simulations for education and debate practice. They are not the real
 * people, are not endorsed by them, and nothing they say is personal financial advice.
 */
export interface Persona {
  id: string;
  name: string;
  title: string;
  initials: string;
  color: string;
  tagline: string;
  philosophy: string[];
  voice: string;
  evaluate: (ctx: TradeContext) => Evaluation;
}

export interface TradeContext {
  trade: TradeIdea;
  inst: Instrument;
  t: Technicals;
  outlook: Outlook;
  geo: GeoRisk;
  newsHeadline?: string;
  newsScore: number;
}

export interface Evaluation {
  stance: number; // -2 strongly against .. +2 strongly for
  points: string[]; // opening arguments, in voice
  risk: string; // the single biggest risk this persona sees
  catalyst?: string;
  rebuttalHook: string; // what they will push back on in others
  oneLiner: string;
}

// ---- Trade features shared by every persona ----

const QUALITY = new Set(["AAPL", "MSFT", "GOOGL", "AMZN", "BRK-B", "KO", "COST", "JPM", "JNJ", "WMT", "UNH", "CAT", "XOM", "CVX", "LLY", "AVGO"]);
const INNOVATION = new Set(["NVDA", "TSLA", "AMD", "COIN", "IBIT", "SMH", "AVGO", "TSM", "META", "GOOGL", "AMZN", "MSFT", "QQQ", "XLK"]);
const BROAD = new Set(["SPY", "VTI", "QQQ", "DIA", "IWM", "^GSPC", "^IXIC", "^DJI", "^RUT"]);
const COMMODITY = new Set(["GLD", "SLV", "USO", "UNG", "WEAT"]);
const CRYPTO = new Set(["IBIT", "COIN"]);

export function features(ctx: TradeContext) {
  const { trade, inst, t } = ctx;
  const leveraged = trade.action === "margin-buy" || trade.action === "buy-calls" || trade.action === "buy-puts";
  const bearish = trade.action === "short" || trade.action === "buy-puts" || trade.action === "sell";
  const options = trade.action === "buy-calls" || trade.action === "buy-puts";
  const shortTerm = trade.horizon === "days" || trade.horizon === "weeks";
  const longTerm = trade.horizon === "years";
  const singleStock = inst.cls === "stock";
  const broad = BROAD.has(inst.symbol) || inst.sector === "Broad Market";
  const concentrated = (trade.portfolioPct ?? 0) > 10;
  const chasing = t.change3m > 0.2 || (t.rsi14 ?? 50) > 70;
  const beaten = t.change3m < -0.15 || (t.rsi14 ?? 50) < 32;
  return {
    leveraged,
    options,
    bearish,
    shortTerm,
    longTerm,
    singleStock,
    broad,
    concentrated,
    chasing,
    beaten,
    quality: QUALITY.has(inst.symbol),
    innovation: INNOVATION.has(inst.symbol) || inst.sector === "Semiconductors" || inst.sector === "Crypto",
    commodity: COMMODITY.has(inst.symbol),
    crypto: CRYPTO.has(inst.symbol) || inst.sector === "Crypto",
    volatile: t.volAnnual > 0.4,
    dca: trade.action === "dca",
    hasDebt: !!trade.hasDebt,
    noEmergency: trade.hasEmergencyFund === false,
  };
}

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const money = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
const clampStance = (x: number) => Math.max(-2, Math.min(2, Math.round(x)));
const actionWord: Record<TradeIdea["action"], string> = {
  buy: "buying",
  sell: "selling",
  short: "shorting",
  "buy-calls": "buying call options on",
  "buy-puts": "buying put options on",
  "margin-buy": "buying on margin",
  dca: "dollar-cost averaging into",
  hold: "holding",
};
export const describeAction = (trade: TradeIdea, inst: Instrument) => `${actionWord[trade.action]} ${inst.name} (${inst.symbol})`;

// ---- Personas ----

export const PERSONAS: Persona[] = [
  {
    id: "ramsey",
    name: "Dave Ramsey",
    title: "Debt-free living & the Baby Steps",
    initials: "DR",
    color: "#c2410c",
    tagline: "Debt is dumb. Cash is king. Get out of debt, then invest for the long haul.",
    philosophy: [
      "Follow the Baby Steps: $1,000 starter emergency fund, pay off all non-mortgage debt with the debt snowball, then 3–6 months of expenses saved.",
      "Only then invest 15% of household income for retirement, in good growth-stock mutual funds held for decades.",
      "No single stocks for your core money, no options, no margin, no crypto, no day trading: that's gambling, not investing.",
      "Never borrow to invest. Never invest money you'll need in the next five years.",
    ],
    voice:
      "Folksy, blunt, high-energy radio-host style from Tennessee. Uses plain talk, short punchy sentences, gentle ribbing (\"that's just dumb\", \"hey, I'm not mad at you\"), and keeps steering back to debt, emergency funds and behaviour. Calls listeners \"buddy\" or \"my friend\". Never uses jargon without mocking it.",
    evaluate(ctx) {
      const f = features(ctx);
      const { trade, inst } = ctx;
      let s = 0;
      const points: string[] = [];
      if (f.hasDebt || f.noEmergency) {
        s -= 2;
        points.push(
          `Hold on, buddy. ${f.hasDebt ? "You've still got debt" : "You don't have a fully funded emergency fund"}. That ${money(trade.amount)} goes to ${f.hasDebt ? "the debt snowball" : "3 to 6 months of expenses in a boring savings account"} first. Personal finance is 80% behaviour and 20% head knowledge.`,
        );
      }
      if (f.leveraged) {
        s -= 2;
        points.push(
          trade.action === "margin-buy"
            ? "Margin? You want to borrow money to gamble on the stock market? That's the dumbest thing you can do with money. Debt is dumb, cash is king."
            : "Options are not investing. That's the casino with better carpet. Most of these contracts expire worthless, and the house always knows it.",
        );
      }
      if (trade.action === "short") {
        s -= 2;
        points.push("Shorting a stock means your losses are unlimited. Unlimited! I don't do anything where the downside has no floor.");
      }
      if (f.crypto) {
        s -= 2;
        points.push("Crypto? I wouldn't put a dime in it. You can't explain where the value comes from, so it's speculation, plain and simple.");
      }
      if (f.singleStock && !f.leveraged) {
        s -= 1;
        points.push(
          `I don't buy single stocks, because one company is one bad quarter away from cutting you in half. ${inst.name} has moved ${pct(ctx.t.change1y)} in a year. Is that the ride you want your retirement on?`,
        );
      }
      if (f.shortTerm && !f.leveraged) {
        s -= 1;
        points.push(`A ${trade.horizon}-long holding period isn't investing, it's trading. If you need this money within five years, it doesn't belong in the market.`);
      }
      if (f.commodity && !f.crypto) {
        s -= 1;
        points.push("Gold and commodities are a lousy long-term investment. They produce nothing and they're mostly driven by fear.");
      }
      if (f.broad && !f.leveraged && !f.bearish && (f.longTerm || f.dca)) {
        s += 2;
        points.push(
          `Now you're talking. A broad, diversified fund, bought ${f.dca ? "a little every month" : "and held"} for the long haul. That's how everyday millionaires get built: steady, boring and consistent.`,
        );
      } else if (f.broad && !f.leveraged && !f.bearish) {
        s += 1;
        points.push("Broad market exposure is the right ballpark. Just stretch that timeline out to decades and quit watching the ticker.");
      }
      if (f.concentrated) {
        s -= 1;
        points.push(`${trade.portfolioPct}% of your portfolio in one idea? Diversify, my friend: growth, growth and income, aggressive growth, and international.`);
      }
      if (!points.length) points.push("I'd rather see you in a handful of good growth mutual funds with a long track record, working with a pro who has the heart of a teacher.");
      return {
        stance: clampStance(s),
        points: points.slice(0, 3),
        risk: f.leveraged ? "Leverage and options can wipe the account out" : f.hasDebt ? "Investing while carrying debt" : "Treating the market like a casino",
        rebuttalHook: "anyone who talks up speculation, leverage or quick wins",
        oneLiner: s >= 1 ? "Steady, boring and long-term. I like it." : s <= -2 ? "Nope. Pay off debt and quit gambling." : "Not how I'd do it. Keep it simple and long-term.",
      };
    },
  },
  {
    id: "buffett",
    name: "Warren Buffett",
    title: "Value investing & economic moats",
    initials: "WB",
    color: "#1d4ed8",
    tagline: "Buy wonderful businesses at fair prices and hold them for a very long time.",
    philosophy: [
      "Buy a business, not a ticker: durable competitive advantage (a moat), honest and able management, sensible price.",
      "Margin of safety: be fearful when others are greedy and greedy when others are fearful.",
      "Our favourite holding period is forever; trying to time the market is a fool's errand.",
      "For most people, a low-cost S&P 500 index fund is the best choice. Derivatives are financial weapons of mass destruction.",
    ],
    voice:
      "Folksy Omaha wisdom, dry humour, homespun analogies (baseball, Coca-Cola, See's Candies, the farm). Calm, patient, a little self-deprecating. References Charlie Munger now and then. Talks about businesses, owners and decades, not charts.",
    evaluate(ctx) {
      const f = features(ctx);
      const { t, inst, trade } = ctx;
      let s = 0;
      const points: string[] = [];
      if (f.options || trade.action === "margin-buy") {
        s -= 2;
        points.push("I've called derivatives financial weapons of mass destruction, and borrowing to buy stocks is how smart people go broke. You only need to get rich once.");
      }
      if (f.crypto) {
        s -= 2;
        points.push("Bitcoin produces nothing. If you offered me all of it for $25, I wouldn't take it, because I wouldn't know what to do with it except sell it back to you.");
      }
      if (f.commodity && !f.crypto) {
        s -= 1;
        points.push("Gold just sits there. You can fondle it, but it won't respond. I'd rather own farmland or businesses that produce something.");
      }
      if (f.quality && !f.leveraged && !f.bearish) {
        s += f.chasing ? 0 : 2;
        points.push(
          `${inst.name} is the kind of business with a real moat. ${f.chasing ? `But it's run ${pct(t.change3m)} in three months, and price is what you pay while value is what you get. I'd wait for a fat pitch.` : t.change3m < -0.05 ? `And it's ${pct(t.change3m)} over three months. When a great business goes on sale, that's when you back up the truck.` : "At a fair price, I'm happy to own it and never check the quote."}`,
        );
      } else if (f.broad && !f.bearish && !f.leveraged) {
        s += 2;
        points.push("For nearly everyone, a low-cost index fund held for decades beats the professionals. I've left instructions for my own estate to do exactly that.");
      } else if (f.singleStock && !f.quality) {
        s -= 0.5;
        points.push(`Before I buy ${inst.name}, I'd want to understand what stops a competitor from eating its lunch ten years from now. If you can't explain the moat, stay inside your circle of competence.`);
      }
      if (f.shortTerm) {
        s -= 1;
        points.push(`If you aren't willing to own a stock for ten years, don't even think about owning it for ${trade.horizon === "days" ? "ten days" : "ten weeks"}. The stock market transfers money from the active to the patient.`);
      }
      if (f.bearish && !f.options) {
        s -= 1;
        points.push("I've never made much betting against America. Over the long run the tailwind is at the owner's back.");
      }
      if (ctx.geo.index >= 60 && !f.bearish && !f.shortTerm) {
        s += 0.5;
        points.push("Headlines are scary right now. That's usually when bargains show up. Be greedy when others are fearful.");
      }
      if (!points.length) points.push("I'd ask one question: would I be comfortable owning this if the market closed for five years?");
      return {
        stance: clampStance(s),
        points: points.slice(0, 3),
        risk: f.chasing ? "Overpaying: no margin of safety" : f.leveraged ? "Leverage forces you to sell at the worst time" : "Owning something you don't understand",
        catalyst: f.quality ? "Durable earnings compounding" : undefined,
        rebuttalHook: "short-term thinking, chart-reading and market timing",
        oneLiner: s >= 1 ? "A sound, patient bet. Hold it for decades." : s <= -1 ? "Not my kind of investment. Stay in your circle." : "Fine business, wrong price or wrong horizon.",
      };
    },
  },
  {
    id: "wood",
    name: "Cathie Wood",
    title: "Disruptive innovation",
    initials: "CW",
    color: "#7c3aed",
    tagline: "Invest in the platforms (AI, robotics, energy storage, blockchain, genomics) that will change the world.",
    philosophy: [
      "Disruptive innovation is the biggest investment opportunity in history: AI, robotics, energy storage, blockchain and multi-omics sequencing are converging.",
      "Think in five-year horizons; volatility is the price of admission for exponential growth.",
      "Wright's Law: costs fall predictably as production scales, opening huge markets.",
      "Use drawdowns to concentrate in highest-conviction names. Traditional benchmarks are full of companies about to be disrupted.",
    ],
    voice:
      "Optimistic, conviction-driven, research-heavy. Talks about five-year price targets, cost declines, Wright's Law, convergence of platforms, and 'our research shows'. Polite but unflinching; frames volatility as opportunity and traditional value investing as backward-looking.",
    evaluate(ctx) {
      const f = features(ctx);
      const { t, inst, trade } = ctx;
      let s = 0;
      const points: string[] = [];
      if (f.innovation && !f.bearish) {
        s += 2;
        points.push(
          `${inst.name} sits right in the convergence of the innovation platforms we research. Our five-year view is driven by cost declines that the market keeps underestimating.`,
        );
        if (t.change3m < -0.1) points.push(`It's ${pct(t.change3m)} over three months. That's exactly when we add. Volatility is the price you pay for exponential growth.`);
        else if (f.chasing) points.push(`Yes, it has run ${pct(t.change3m)}, but if the total addressable market is ten times bigger than consensus, today's price will look like a bargain in 2030.`);
      } else if (f.innovation && f.bearish) {
        s -= 2;
        points.push(`Betting against ${inst.name} is betting against innovation. Shorts in disruptive names get squeezed when the fundamentals inflect.`);
      } else if (inst.sector === "Energy" || inst.sector === "Consumer Staples" || inst.sector === "Utilities" || f.commodity) {
        s += f.bearish ? 1 : -1;
        points.push(`${inst.name} is on the wrong side of change. Innovation is deflationary, and old-economy business models face disruption from AI, autonomous transport and cheap energy storage.`);
      } else if (f.broad) {
        s += 0;
        points.push("Broad benchmarks are increasingly made of companies that will be disrupted. You end up owning the past along with the future.");
      } else {
        points.push(`I'd ask whether ${inst.name} is a disruptor or about to be disrupted. That question matters far more than this quarter's chart.`);
      }
      if (f.shortTerm) {
        s -= 1;
        points.push(`A holding period measured in ${trade.horizon} misses the point. We're focused on where this is in five years, not next ${trade.horizon === "days" ? "week" : "month"}.`);
      }
      if (f.crypto && !f.bearish) points.push("Bitcoin is a new asset class, a rules-based global monetary system. Institutions are only beginning to allocate.");
      return {
        stance: clampStance(s),
        points: points.slice(0, 3),
        risk: "Missing the exponential phase of an S-curve",
        catalyst: f.innovation ? "AI-driven cost declines expanding the addressable market" : undefined,
        rebuttalHook: "backward-looking valuation metrics and anyone who says 'it's already priced in'",
        oneLiner: s >= 1 ? "High conviction. This is where the future is being built." : s <= -1 ? "Wrong side of innovation." : "Not an innovation story either way.",
      };
    },
  },
  {
    id: "dalio",
    name: "Ray Dalio",
    title: "Macro, debt cycles & diversification",
    initials: "RD",
    color: "#0f766e",
    tagline: "Understand the machine: debt cycles, the changing world order, and the holy grail of diversification.",
    philosophy: [
      "The economy is a machine of short and long debt cycles; know where we are in them.",
      "Diversify across uncorrelated return streams (stocks, bonds, gold, commodities, regions): the holy grail of investing.",
      "Watch the changing world order: rising great-power conflict, internal political division and large debts.",
      "Pain + reflection = progress. Be radically transparent about what you don't know.",
    ],
    voice:
      "Measured, systematic, principle-driven. Speaks of 'the machine', cycles, correlations, risk parity, and 'what would cause me to be wrong'. Brings in history (1930s, 1970s, Dutch and British empires) and geopolitics, especially US–China. Calm, probabilistic language.",
    evaluate(ctx) {
      const f = features(ctx);
      const { geo, inst, t } = ctx;
      let s = 0;
      const points: string[] = [];
      const drivers = geo.drivers.slice(0, 2).map((d) => d.label).join(" and ");
      points.push(
        `First, where are we in the cycle? Geopolitical risk reads ${geo.index}/100 (${geo.label.toLowerCase()})${drivers ? `, driven by ${drivers}` : ""}. In periods like this, the range of outcomes widens, so position size matters more than conviction.`,
      );
      if (f.commodity && inst.symbol === "GLD" && !f.bearish) {
        s += 2;
        points.push("Gold is an effective diversifier when debts are large and great powers are in conflict. Central banks are buying it for the same reason. A 5–10% allocation makes sense in a balanced portfolio.");
      } else if (f.broad && !f.bearish && !f.leveraged) {
        s += 1;
        points.push("A broad equity holding is fine as one return stream, but on its own it's a concentrated bet on one economic environment: growth with falling inflation. Balance it with bonds, gold and other regions.");
      } else if (f.concentrated || (f.singleStock && f.volatile)) {
        s -= 1;
        points.push(`${inst.name} is a single, volatile return stream (${(t.volAnnual * 100).toFixed(0)}% annualised volatility). A portfolio of fifteen uncorrelated bets can cut risk by about 80% without giving up return.`);
      }
      if (f.leveraged) {
        s -= 1;
        points.push("Leverage is fine only when it's balanced across assets. Levering a single directional bet is how people get knocked out of the game.");
      }
      if (geo.index >= 55 && !f.bearish && f.innovation && inst.region !== "US") {
        s -= 1;
        points.push("Supply chains running through contested regions carry a conflict risk that's hard to model and easy to underprice.");
      } else if (geo.index >= 55 && f.bearish) {
        s += 1;
        points.push("A hedge against an escalating world-order conflict is reasonable, as long as it's sized as a hedge and not a bet.");
      }
      if (inst.symbol === "TLT" && !f.bearish) points.push("Bonds will help in a deflationary downturn, but with large deficits there's real risk of currency debasement over the long run.");
      return {
        stance: clampStance(s),
        points: points.slice(0, 3),
        risk: `Concentration in one environment while geopolitical risk is ${geo.label.toLowerCase()}`,
        catalyst: geo.index >= 50 ? "Safe-haven flows if conflict escalates" : undefined,
        rebuttalHook: "concentrated, single-scenario bets and ignoring the macro cycle",
        oneLiner: s >= 1 ? "Reasonable, as one balanced return stream." : s <= -1 ? "Too concentrated for this part of the cycle." : "Depends on what else you hold. Diversify.",
      };
    },
  },
  {
    id: "orman",
    name: "Suze Orman",
    title: "Personal finance & security first",
    initials: "SO",
    color: "#be185d",
    tagline: "People first, then money, then things. Security before speculation.",
    philosophy: [
      "Keep an emergency savings fund of 8–12 months of expenses before you take market risk.",
      "No credit card debt, ever. Max out your Roth IRA.",
      "Invest money you won't need for at least five years; dollar-cost average into quality ETFs.",
      "Stand in your truth: know whether you can truly afford this, not just whether it might go up.",
    ],
    voice:
      "Direct, emotional and empowering, with a TV call-in show energy. Asks 'Are you sure you can afford this?', says 'Denied!' or 'Approved!' as a verdict, uses the listener's feelings, and keeps returning to security, emergency funds, Roth IRAs and never carrying credit card debt.",
    evaluate(ctx) {
      const f = features(ctx);
      const { trade, inst } = ctx;
      let s = 0;
      const points: string[] = [];
      if (f.noEmergency || f.hasDebt) {
        s -= 2;
        points.push(`Stop right there. ${f.hasDebt ? "If you're carrying credit card debt at 20-plus percent, paying it off is a guaranteed return no stock can match." : "Do you have eight to twelve months of expenses saved?"} Until that's handled, this is DENIED.`);
      }
      if (f.leveraged || trade.action === "short" || f.crypto) {
        s -= 1.5;
        points.push(`${describeAction(trade, inst)} is speculation. If you have money you can truly afford to lose, a small amount, fine. But most people who call me with these trades can't.`);
      }
      if ((f.broad || f.dca) && !f.leveraged && !f.bearish) {
        s += 2;
        points.push(`Dollar-cost averaging into a broad ETF over at least five years? ${f.noEmergency || f.hasDebt ? "Once your emergency fund is in place, " : ""}that is APPROVED. Even better if it's inside a Roth IRA.`);
      } else if (f.singleStock && !f.leveraged && !f.bearish) {
        s += f.quality ? 0.5 : -0.5;
        points.push(`${inst.name} might be a fine company, but how much of your money is in it? Keep any single stock to a small slice, and only with money you won't touch for five years.`);
      }
      if (f.shortTerm) {
        s -= 1;
        points.push("If you need this money soon, it belongs in a high-yield savings account or Treasury bills, not in the stock market.");
      }
      return {
        stance: clampStance(s),
        points: points.slice(0, 3),
        risk: "Risking money you can't afford to lose",
        rebuttalHook: "anyone who skips over whether the investor can afford it",
        oneLiner: s >= 1 ? "Approved, once your security is in place." : s <= -1 ? "Denied. Security first." : "Only with money you can truly afford to lose.",
      };
    },
  },
  {
    id: "cramer",
    name: "Jim Cramer",
    title: "Active stock picking & catalysts",
    initials: "JC",
    color: "#b45309",
    tagline: "There's always a bull market somewhere. Do your homework!",
    philosophy: [
      "Own five to ten stocks across different sectors, and do at least an hour of homework per stock per week.",
      "Bulls make money, bears make money, pigs get slaughtered: ring the register on big winners.",
      "Earnings, guidance and catalysts move stocks; know the date of the next one.",
      "One speculative position is fine. Just one, and sized small.",
    ],
    voice:
      "Loud, rapid-fire, theatrical TV energy. Uses 'Booyah!', 'Buy buy buy!', 'Sell sell sell!', 'Do your homework!', 'Bulls make money, bears make money, pigs get slaughtered.' Talks about catalysts, earnings, charts, sector rotation and the 'house of pain'. Enthusiastic but warns about discipline.",
    evaluate(ctx) {
      const f = features(ctx);
      const { t, inst, outlook, trade } = ctx;
      let s = 0;
      const points: string[] = [];
      const up = outlook.score > 12;
      const down = outlook.score < -12;
      if (!f.bearish) {
        if (up) {
          s += 1.5;
          points.push(`Booyah! ${inst.name} is in a ${t.trend.replace("-", " ")} trend with an outlook score of ${outlook.score}. The chart's talking and you need to listen.`);
        } else if (down) {
          s -= 1;
          points.push(`The tape is telling you something: ${inst.name} is ${pct(t.change1m)} this month and the momentum is negative. Don't try to catch a falling knife!`);
        } else points.push(`${inst.name} is stuck in the mud. You need a catalyst, an earnings beat or a guidance raise, before you pull the trigger.`);
        if (f.chasing) {
          s -= 0.5;
          points.push(`But RSI is ${(t.rsi14 ?? 0).toFixed(0)}. Don't chase! Buy half now and half on a pullback. Pigs get slaughtered.`);
        }
      } else {
        if (down) {
          s += 1;
          points.push(`Sell sell sell? The trend says you're not crazy: ${inst.name} is ${pct(t.change3m)} over three months. But be disciplined with your stop.`);
        } else {
          s -= 1;
          points.push(`You want to fight a stock in a ${t.trend.replace("-", " ")}? Never fight the tape, my friend!`);
        }
      }
      if (f.options) {
        s -= 0.5;
        points.push("Options are fine for pros. Buy the stock, not the calls: time decay is a killer and you can be right and still lose.");
      }
      if (f.concentrated) {
        s -= 1;
        points.push(`${trade.portfolioPct}% in one name? Diversification is the only free lunch. Five sectors, minimum!`);
      }
      if (ctx.newsHeadline) points.push(`And do your homework on the headline everybody's trading: "${ctx.newsHeadline.slice(0, 90)}".`);
      return {
        stance: clampStance(s),
        points: points.slice(0, 3),
        risk: "Chasing without a catalyst or a stop",
        catalyst: up ? "Momentum and earnings follow-through" : undefined,
        rebuttalHook: "anyone who ignores what the chart and catalysts are saying",
        oneLiner: s >= 1 ? "Buy buy buy, but in stages!" : s <= -1 ? "Sell, or stay on the sidelines!" : "Wait for the catalyst. Do your homework.",
      };
    },
  },
  {
    id: "lynch",
    name: "Peter Lynch",
    title: "Invest in what you know",
    initials: "PL",
    color: "#4d7c0f",
    tagline: "Know what you own and why you own it. Look for ten-baggers in everyday life.",
    philosophy: [
      "Invest in what you know: great ideas often start at the mall, at work, in everyday life.",
      "Sort companies into categories (slow growers, stalwarts, fast growers, cyclicals, turnarounds, asset plays) and judge them accordingly.",
      "Growth at a reasonable price; the PEG ratio matters more than the P/E alone.",
      "Far more money has been lost preparing for corrections than in corrections themselves.",
    ],
    voice:
      "Friendly, curious Boston fund-manager storytelling. Uses everyday examples (Dunkin', L'eggs, the mall), the 'two-minute drill', stalwarts versus fast growers, ten-baggers, and warns against market timing. Warm and practical.",
    evaluate(ctx) {
      const f = features(ctx);
      const { inst, t, trade } = ctx;
      let s = 0;
      const points: string[] = [];
      const category = f.commodity
        ? "a commodity, not a company"
        : inst.sector === "Energy" || inst.sector === "Materials" || inst.sector === "Industrials"
          ? "a cyclical"
          : f.quality
            ? "a stalwart"
            : f.innovation
              ? "a fast grower"
              : f.broad
                ? "a basket of companies"
                : t.change1y < -0.25
                  ? "a possible turnaround"
                  : "hard to categorise";
      points.push(`Give me the two-minute drill: why own ${inst.name}? I'd call it ${category}, and you have to judge it that way.`);
      if (f.singleStock && !f.leveraged && !f.bearish) {
        s += 1;
        if (category === "a cyclical") points.push("With cyclicals, timing the cycle is everything. Buying after a big run in a cyclical is how you get hurt.");
        else if (category === "a fast grower") points.push(`Fast growers can be ten-baggers, but only if growth keeps running ahead of the price. It's ${pct(t.change1y)} over a year, so check that the earnings kept up.`);
        else points.push("Stalwarts won't make you rich overnight, but buying them on a 30% dip and holding works well.");
      }
      if (trade.thesis && trade.thesis.length > 25) {
        s += 0.5;
        points.push("I like that you wrote down a thesis. Check it every few months. If the story changes, sell; if only the price changes, think about buying more.");
      } else {
        s -= 0.5;
        points.push("You haven't told me the story. If you can't explain it to a ten-year-old in two minutes, don't buy it.");
      }
      if (f.shortTerm) {
        s -= 1;
        points.push("Trying to call where it goes over the next few weeks is a coin flip. Far more money has been lost preparing for corrections than in the corrections themselves.");
      }
      if (f.options) s -= 1;
      return {
        stance: clampStance(s),
        points: points.slice(0, 3),
        risk: "Not knowing the story behind the stock",
        catalyst: category === "a fast grower" ? "Earnings growth outrunning the share price" : undefined,
        rebuttalHook: "macro forecasting and market timing",
        oneLiner: s >= 1 ? "Good story. Own it and keep checking it." : s <= -1 ? "No clear story. Pass." : "Do the two-minute drill first.",
      };
    },
  },
];

export function personaById(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

export const DEFAULT_PANEL = ["ramsey", "buffett", "wood", "dalio", "cramer"];
