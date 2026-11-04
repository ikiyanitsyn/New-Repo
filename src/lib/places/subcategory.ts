import type { Place, PlaceCategory } from "./types";

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

/**
 * Three picks to show first. Stays and food get one per price level when the
 * guide has them ("Splurge pick", "Best value", "Budget pick"); sights get the
 * best-documented places.
 */
export function picksFor(places: Place[], category: PlaceCategory): { place: Place; label: string }[] {
  const ranked = [...places].sort((a, b) => featureScore(b) - featureScore(a));
  if (category === "sleep" || category === "eat") {
    const labels: Record<string, string> = { Splurge: category === "sleep" ? "Splurge stay" : "Special occasion", "Mid-range": "Best value", Budget: "Easy on the budget" };
    const out = (["Splurge", "Mid-range", "Budget"] as const)
      .map((t) => ranked.find((p) => p.tier === t))
      .filter((p): p is Place => !!p)
      .map((p) => ({ place: p, label: labels[p.tier!] }));
    if (out.length >= 2) return out;
  }
  const label = { sleep: "Recommended stay", see: "Must see", do: "Worth doing", eat: "Worth the trip", drink: "Local favourite", buy: "Worth a browse" }[category];
  return ranked.slice(0, 3).map((p) => ({ place: p, label }));
}
