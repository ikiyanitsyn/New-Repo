import type { Comfort, Place, PlaceCategory } from "./types";

/**
 * Friendly subcategories, so a long list becomes a few approachable groups.
 * Rules look at the guide's own sub-heading first, then the name and description.
 * The first matching rule wins; anything unmatched falls into the last group.
 */

interface Rule { label: string; words: RegExp }

const RULES: Record<PlaceCategory, Rule[]> = {
  sleep: [
    { label: "Luxury", words: /\b(splurge|luxury|five[- ]star|5[- ]star|ritz|mandarin oriental|peninsula|aman|four seasons|park hyatt|rosewood|waldorf|st\.? regis|bulgari|shangri-la)\b/i },
    { label: "Boutique & heritage", words: /\b(boutique|courtyard|siheyuan|heritage|historic|design hotel|ryokan|hanok|guesthouse in a)\b/i },
    { label: "Hostels & budget", words: /\b(budget|hostel|backpack|dorm|capsule)\b/i },
    { label: "Comfortable hotels", words: /./ },
  ],
  see: [
    { label: "Temples & sacred sites", words: /\b(temple|monastery|shrine|mosque|church|cathedral|pagoda|lama|buddh|tao|confucian|basilica|synagogue)\b/i },
    { label: "Museums & galleries", words: /\b(museum|gallery|exhibition|art (centre|center|district)|798)\b/i },
    { label: "Palaces & landmarks", words: /\b(palace|forbidden city|wall|tower|gate|tomb|mausoleum|fort|castle|square|terracotta|bridge|landmark|historic)\b/i },
    { label: "Parks & gardens", words: /\b(park|garden|lake|hill|mountain|zoo|panda|river|beach|scenic|nature|botanical)\b/i },
    { label: "Neighbourhoods & streets", words: /\b(hutong|street|lane|alley|quarter|district|old town|market|bund|neighbo)\w*/i },
    { label: "Other sights", words: /./ },
  ],
  do: [
    { label: "Tours & day trips", words: /\b(tour|day trip|excursion|cruise|walk(ing)? tour|hike|trek)\b/i },
    { label: "Shows & performances", words: /\b(opera|theatre|theater|show|acrobat|concert|performance|kung fu|cinema)\b/i },
    { label: "Wellness & spa", words: /\b(spa|massage|hot spring|onsen|bath|yoga|tai chi|wellness)\b/i },
    { label: "Classes & workshops", words: /\b(class|course|cooking|workshop|lesson|calligraphy|learn)\b/i },
    { label: "Outdoors & sport", words: /\b(bike|cycling|kayak|climb|ski|swim|golf|boat|outdoor)\b/i },
    { label: "Festivals & more", words: /./ },
  ],
  eat: [
    { label: "Fine dining", words: /\b(splurge|fine dining|michelin|tasting menu|degustation|haute)\b/i },
    { label: "Local specialties", words: /\b(peking duck|roast duck|hot ?pot|dumpling|noodle|dim sum|sichuan|cantonese|xiaolongbao|ramen|sushi|kimchi|tapas|trattoria|local)\b/i },
    { label: "Street food & casual", words: /\b(budget|street|stall|snack|market|food court|hawker|cheap|canteen|fast)\b/i },
    { label: "Cafés & tea", words: /\b(caf[eé]|coffee|tea|bakery|dessert|brunch)\b/i },
    { label: "Restaurants", words: /./ },
  ],
  drink: [
    { label: "Cocktail & rooftop bars", words: /\b(cocktail|rooftop|lounge|speakeasy|hotel bar|whisk(e)?y)\b/i },
    { label: "Tea houses & cafés", words: /\b(tea|caf[eé]|coffee)\b/i },
    { label: "Craft beer & pubs", words: /\b(beer|brew|pub|taproom|ale)\b/i },
    { label: "Clubs & live music", words: /\b(club|live music|jazz|dj|dance|karaoke)\b/i },
    { label: "Bars", words: /./ },
  ],
  buy: [
    { label: "Markets", words: /\b(market|bazaar)\b/i },
    { label: "Malls & department stores", words: /\b(mall|plaza|department|centre|center)\b/i },
    { label: "Shops", words: /./ },
  ],
};

export function subcategoryOf(p: Place): string {
  const text = `${p.tier ?? ""} ${p.group ?? ""} ${p.name} ${p.alt ?? ""} ${p.description ?? ""}`;
  // The guide's sub-heading is the strongest signal.
  const rules = RULES[p.category];
  if (p.group) {
    const byHeading = rules.find((r) => r.label !== rules[rules.length - 1].label && r.words.test(p.group!));
    if (byHeading) return byHeading.label;
  }
  if (p.category === "sleep" && p.tier === "Splurge") return "Luxury";
  if (p.category === "sleep" && p.tier === "Budget") return "Hostels & budget";
  if (p.category === "eat" && p.tier === "Splurge") return "Fine dining";
  return rules.find((r) => r.words.test(text))!.label;
}

export function subcategoryOrder(category: PlaceCategory): string[] {
  return RULES[category].map((r) => r.label);
}

/** How strongly to feature a place: photos and Wikipedia articles signal notable, well-documented places. */
export function featureScore(p: Place): number {
  return (p.image || p.thumb ? 3 : 0) + (p.wikipedia ? 2 : 0) + (p.lat !== undefined ? 1 : 0) + ((p.description?.length ?? 0) > 90 ? 1 : 0);
}

export interface RatingLike {
  rating?: number;
  count?: number;
  priceLevel?: number;
}

export interface PicksOptions {
  /** Ratings by place id, when a ratings provider is configured. */
  ratings?: Record<string, RatingLike | null | undefined>;
  /** The traveller's comfort level, from the concierge. */
  comfort?: Comfort;
}

export interface Pick { place: Place; label: string }

/** Price levels each comfort level leans towards (stays and food only). */
export const COMFORT_TIERS: Record<Comfort, NonNullable<Place["tier"]>[]> = {
  Luxury: ["Splurge"],
  "Good value": ["Budget", "Mid-range"],
  Comfortable: ["Mid-range"],
};

const COMFORT_PICK_LABEL: Record<Comfort, Record<"sleep" | "eat", string>> = {
  Luxury: { sleep: "Luxury pick", eat: "Special occasion" },
  "Good value": { sleep: "Best value", eat: "Good value" },
  Comfortable: { sleep: "Comfortable pick", eat: "Comfortable pick" },
};

/** Ratings with fewer reviews than this don't decide picks (they still show). */
export const MIN_RATINGS_FOR_PICKS = 20;

const tiered = (c: PlaceCategory): c is "sleep" | "eat" => c === "sleep" || c === "eat";

/** The place's price level, from the guide's heading or else the provider's price level. */
export function priceTier(p: Place, r?: RatingLike | null): Place["tier"] {
  if (p.tier) return p.tier;
  const lvl = r?.priceLevel;
  if (lvl === undefined) return undefined;
  return lvl <= 1 ? "Budget" : lvl === 2 ? "Mid-range" : "Splurge";
}

/** Whether a stay or restaurant suits the traveller's comfort level. */
export function fitsComfort(p: Place, comfort: Comfort | undefined, r?: RatingLike | null): boolean {
  if (!comfort || !tiered(p.category)) return false;
  const tier = priceTier(p, r);
  if (tier) return COMFORT_TIERS[comfort].includes(tier);
  // No price level: the subcategory still hints at it.
  const sub = subcategoryOf(p);
  if (comfort === "Luxury") return sub === "Luxury" || sub === "Fine dining";
  if (comfort === "Good value") return sub === "Hostels & budget" || sub === "Street food & casual";
  return false;
}

/**
 * A rating that accounts for how many people gave it: a 4.9 from 25 reviews
 * shouldn't beat a 4.7 from 3,000. Small samples are pulled towards 4.2.
 */
export function ratingScore(r: RatingLike | null | undefined): number | undefined {
  if (!r || typeof r.rating !== "number" || (r.count ?? 0) < MIN_RATINGS_FOR_PICKS) return undefined;
  const n = r.count!, prior = 4.2, weight = 50;
  return (r.rating * n + prior * weight) / (n + weight);
}

const DEFAULT_LABEL: Record<PlaceCategory, string> = {
  sleep: "Recommended stay", see: "Must see", do: "Worth doing", eat: "Worth the trip", drink: "Local favourite", buy: "Worth a browse",
};

/**
 * Three picks to show first.
 *
 * With ratings: the best-rated places (weighted by how many people rated them),
 * nudged towards the traveller's comfort level. Labels say why, honestly:
 * "Highest rated · 4.7" only for the place with the top weighted rating,
 * "Luxury pick · 4.6" when comfort decided it, otherwise "Rated 4.5".
 *
 * Without ratings: the guide's own signals (featureScore). Stays and food get
 * one per price level ("Splurge stay", "Best value", "Easy on the budget"),
 * the traveller's comfort level first; sights get the best-documented places.
 */
export function picksFor(places: Place[], category: PlaceCategory, opts: PicksOptions = {}): Pick[] {
  const { ratings = {}, comfort } = opts;
  const r = (p: Place) => ratings[p.id];
  const fits = (p: Place) => fitsComfort(p, comfort, r(p));
  const comfortLabel = (p: Place) => (comfort && tiered(category) && fits(p) ? COMFORT_PICK_LABEL[comfort][category] : DEFAULT_LABEL[category]);
  const ranked = [...places].sort((a, b) => Number(fits(b)) - Number(fits(a)) || featureScore(b) - featureScore(a));

  const scored = places
    .map((p) => ({ p, score: ratingScore(r(p)) }))
    .filter((x): x is { p: Place; score: number } => x.score !== undefined);

  if (scored.length) {
    const top = Math.max(...scored.map((x) => x.score));
    const bonus = (p: Place) => (fits(p) ? 0.25 : 0);
    scored.sort((a, b) => b.score + bonus(b.p) - (a.score + bonus(a.p)) || featureScore(b.p) - featureScore(a.p));
    const out: Pick[] = scored.slice(0, 3).map(({ p, score }) => {
      const stars = r(p)!.rating!.toFixed(1);
      if (score === top) return { place: p, label: `Highest rated · ${stars}` };
      if (comfort && tiered(category) && fits(p)) return { place: p, label: `${COMFORT_PICK_LABEL[comfort][category]} · ${stars}` };
      return { place: p, label: `Rated ${stars}` };
    });
    // Too few rated places: fill from the guide's own favourites.
    const taken = new Set(out.map((x) => x.place.id));
    for (const p of ranked) {
      if (out.length >= 3) break;
      if (!taken.has(p.id)) out.push({ place: p, label: comfortLabel(p) });
    }
    return out;
  }

  if (tiered(category)) {
    const labels: Record<string, string> = { Splurge: category === "sleep" ? "Splurge stay" : "Special occasion", "Mid-range": "Best value", Budget: "Easy on the budget" };
    const order: NonNullable<Place["tier"]>[] = ["Splurge", "Mid-range", "Budget"];
    if (comfort) order.sort((a, b) => Number(COMFORT_TIERS[comfort].includes(b)) - Number(COMFORT_TIERS[comfort].includes(a)));
    const byScore = [...places].sort((a, b) => featureScore(b) - featureScore(a));
    const out = order
      .map((t) => byScore.find((p) => p.tier === t))
      .filter((p): p is Place => !!p)
      .map((p) => ({ place: p, label: labels[p.tier!] }));
    if (out.length >= 2) return out;
  }
  return ranked.slice(0, 3).map((p) => ({ place: p, label: comfortLabel(p) }));
}
