import type { Article } from "../types";

/**
 * Illustrative headlines used only when none of the five live feeds can be reached
 * (offline, or a network that blocks them). They are written to exercise every theme the
 * analysis engine understands, are never attributed to a real outlet, and the UI labels them
 * as samples.
 */
const SAMPLES: [number, string, string][] = [
  [1, "Oil jumps as tanker attacks in the Red Sea raise fears over Strait of Hormuz shipping", "Brent crude climbed as insurers raised war-risk premiums and several shipping lines rerouted vessels around the Cape of Good Hope."],
  [2, "Fed officials signal patience on rate cuts as core inflation proves sticky", "Several policymakers said they need more evidence that inflation is cooling before easing again; Treasury yields edged higher."],
  [3, "Nvidia supplier orders point to another quarter of record AI data center demand", "Hyperscalers are expanding capital spending on AI infrastructure, lifting chipmakers across the semiconductor sector."],
  [4, "U.S. weighs new export controls on advanced chips to China", "The proposal would tighten restrictions on AI accelerators and chipmaking tools, a risk for semiconductor equipment makers."],
  [5, "China stages military drills around Taiwan after U.S. arms sale", "Beijing's exercises near the Taiwan Strait rattled Asian markets; Taiwan stocks and the Hang Seng slipped."],
  [6, "White House announces new tariffs on imported autos and steel", "The administration said duties of 25% would take effect next month, prompting threats of retaliation from trading partners."],
  [7, "OPEC+ agrees to extend output cuts into next quarter", "The producer group said it would keep supply tight, supporting crude prices and energy stocks."],
  [8, "European leaders agree fresh sanctions package on Russia; gas prices climb", "The measures target energy revenues and shipping; European natural gas futures rose on supply worries."],
  [9, "Defense stocks rally as NATO members pledge higher military spending", "Lockheed Martin and RTX gained after allies committed to raise defense budgets amid the war in Ukraine."],
  [10, "Treasury yields fall after jobs report shows hiring slowdown", "Nonfarm payrolls rose less than expected and the unemployment rate ticked up, boosting bets on a Fed rate cut."],
  [11, "CPI cools more than expected, lifting hopes for rate cuts", "Consumer prices rose at the slowest pace in months; stocks rallied and the dollar weakened."],
  [12, "Apple shares slip as iPhone sales in China disappoint", "Apple reported weaker-than-expected revenue from Greater China amid stiff local competition."],
  [13, "Tesla deliveries miss estimates as EV price war intensifies", "Tesla shares fell after quarterly deliveries came in below Wall Street forecasts."],
  [14, "JPMorgan beats earnings estimates on strong trading and net interest income", "Big banks kicked off earnings season with results that topped expectations."],
  [15, "Gold hits record high as investors seek haven amid geopolitical tensions", "Bullion extended its rally as central bank buying and conflict risks drove demand for safe havens."],
  [16, "Government shutdown looms as Congress deadlocks on spending bill", "Lawmakers failed to agree on a stopgap funding measure, raising the risk of a federal shutdown and delayed economic data."],
  [17, "Antitrust regulators sue Alphabet over ad tech dominance", "The lawsuit seeks to break up parts of Google's advertising business, adding to regulatory pressure on big tech."],
  [18, "Bitcoin surges past key level as spot ETF inflows accelerate", "Crypto assets rallied on heavy inflows into bitcoin ETFs and expectations of friendlier regulation."],
  [19, "Hurricane forces Gulf of Mexico oil platforms to shut production", "Energy companies evacuated offshore rigs as the storm strengthened, curbing crude and natural gas output."],
  [20, "Regional bank shares tumble on commercial real estate loan losses", "Concerns about office property loans resurfaced after a lender reported a surprise loss and cut its dividend."],
  [21, "Israel and Iran trade strikes, raising fears of wider Middle East war", "Markets moved to safe havens: oil and gold rose while airline and travel stocks fell."],
  [22, "Ceasefire talks gain momentum, easing pressure on oil prices", "Diplomats reported progress toward a truce, and crude retreated from recent highs."],
  [23, "Eli Lilly gains after weight-loss drug wins expanded approval", "The drugmaker's shares rose on the regulatory win, lifting healthcare stocks."],
  [24, "Boeing faces fresh safety probe; airlines warn of delivery delays", "Regulators opened an investigation into a production issue, pressuring Boeing shares."],
  [25, "Japan's yen surges after Bank of Japan signals another rate hike", "A stronger yen weighed on Japanese exporters and the Nikkei."],
  [26, "Port strike threatens supply chain disruption on East Coast", "Dockworkers authorized a strike that could snarl shipping and lift freight costs for retailers."],
  [27, "Retail sales beat forecasts as consumer spending stays resilient", "Strong holiday-season sales lifted retailers and consumer discretionary stocks."],
  [28, "India-Pakistan border tensions flare, emerging market stocks wobble", "Investors pulled money from emerging market funds as military tensions escalated."],
  [29, "Microsoft and Amazon raise AI capex guidance, cloud growth accelerates", "Both companies said demand for AI services outstrips supply, a boost for chipmakers and data center suppliers."],
  [30, "Election uncertainty lifts volatility as polls tighten", "The VIX rose as investors hedged ahead of the vote; defense and energy stocks were seen as policy-sensitive."],
];

export function sampleArticles(now = Date.now()): Article[] {
  return SAMPLES.map(([n, title, summary]) => ({
    id: `sample-${n}`,
    sourceId: "sample",
    sourceName: "Sample feed",
    title,
    summary,
    url: null,
    published: now - n * 47 * 60 * 1000,
    sample: true,
  }));
}
