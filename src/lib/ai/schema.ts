import { z } from "zod";

/**
 * What the concierge sends back. Every AI reply is checked against this before use.
 *
 * The reply schemas are deliberately forgiving: over-long text is trimmed at a word boundary,
 * long lists are cut short, and individual bad entries (a day with a broken date, a question
 * with one option) are dropped. A reply is only rejected when it isn't usable at all.
 * `PlanRequest` (what the browser sends) stays strict.
 */

/** Cut text to `max` characters at a word boundary and add an ellipsis. */
export function clip(text: string, max: number): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  let cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  if (space > max * 0.6) cut = cut.slice(0, space);
  return cut.replace(/[\s,;:.\-–—(]+$/u, "") + "…";
}

/** A required string, trimmed to `max`. Numbers are accepted and turned into text. */
const text = (max: number) =>
  z.preprocess((v) => (typeof v === "number" ? String(v) : v), z.string()).transform((s) => clip(s, max));

/** A string that must have something in it after trimming. */
const filled = (max: number) => text(max).pipe(z.string().min(1));

/** An optional string: missing, null, empty or malformed all become undefined. */
const optText = (max: number) =>
  z
    .preprocess((v) => (v == null || (typeof v === "string" && !v.trim()) ? undefined : v), text(max).optional())
    .catch(undefined);

const flag = z.preprocess((v) => v === true || v === "true", z.boolean());

/**
 * A list that keeps the entries that pass `item` and drops the rest, then keeps at most `max`.
 * A missing or null list becomes empty; a single object is treated as a one-item list.
 */
export function lenientArray<T extends z.ZodType>(item: T, max: number) {
  return z
    .preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.unknown()))
    .transform((list) => {
      const out: z.output<T>[] = [];
      for (const x of list) {
        if (out.length >= max) break;
        const r = item.safeParse(x);
        if (r.success) out.push(r.data);
      }
      return out;
    });
}

const KINDS = ["see", "do", "eat", "drink", "stay", "travel", "free"] as const;
export const ItemKind = z.enum(KINDS);
type Kind = z.infer<typeof ItemKind>;

const KIND_ALIASES: Record<string, Kind> = {
  sight: "see", sights: "see", sightseeing: "see", visit: "see", museum: "see", temple: "see",
  activity: "do", experience: "do", tour: "do", shop: "do", shopping: "do",
  food: "eat", meal: "eat", dining: "eat", breakfast: "eat", lunch: "eat", dinner: "eat", restaurant: "eat",
  bar: "drink", drinks: "drink", tea: "drink", coffee: "drink", nightlife: "drink",
  hotel: "stay", sleep: "stay", lodging: "stay", accommodation: "stay", "check-in": "stay",
  transport: "travel", transfer: "travel", flight: "travel", train: "travel", transit: "travel",
  rest: "free", relax: "free", leisure: "free", "free time": "free",
};

/** Unknown kinds fall back to "see" rather than failing the item. */
const kind = z
  .preprocess((v) => {
    if (typeof v !== "string") return v;
    const k = v.trim().toLowerCase();
    return (KINDS as readonly string[]).includes(k) ? k : KIND_ALIASES[k] ?? k;
  }, ItemKind)
  .catch("see");

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/);

const cityCode = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().length(3));

export const PlanItem = z.object({
  time: text(20).catch(""), // "Morning", "Afternoon", "Evening" or "09:30"
  title: filled(120),
  kind,
  placeName: optText(120),
  note: optText(400),
});

export const PlanDay = z.object({
  date: isoDate,
  city: cityCode,
  title: text(120).catch(""),
  items: lenientArray(PlanItem, 8),
});

export const Question = z
  .object({
    id: text(40).catch(""),
    question: filled(160),
    options: lenientArray(filled(60), 6).pipe(z.array(z.string()).min(2)),
    multi: flag.catch(false),
  })
  .transform((q) => ({
    ...q,
    id: q.id || q.question.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "") || "question",
  }));

export const BeforeYouGo = z.object({
  topic: filled(40),
  summary: text(300).catch(""),
  details: lenientArray(filled(300), 6),
  important: flag.catch(false),
});

const nights = z.preprocess(
  (v) => (typeof v === "string" ? Number(v) : v),
  z.number().finite().transform((n) => Math.min(30, Math.max(1, Math.round(n)))),
);

export const RouteSuggestion = z.object({
  reason: text(400).catch(""),
  stops: lenientArray(z.object({ city: cityCode, nights }), 8).pipe(z.array(z.object({ city: z.string(), nights: z.number() })).min(1)),
});

export const PlanResponse = z.object({
  title: text(80).catch(""),
  summary: text(600).catch(""),
  questions: lenientArray(Question, 4),
  routeSuggestion: RouteSuggestion.nullish().catch(null),
  days: lenientArray(PlanDay, 30),
  beforeYouGo: lenientArray(BeforeYouGo, 10),
});

/** A day-plan chunk reply: just the days for a few consecutive slots. */
export const DaysReply = z.object({ days: lenientArray(PlanDay, 30) });

export type PlanResponse = z.infer<typeof PlanResponse>;
export type PlanDay = z.infer<typeof PlanDay>;
export type PlanItem = z.infer<typeof PlanItem>;
export type Question = z.infer<typeof Question>;

/** What the browser sends. */
export const PlanRequest = z.object({
  request: z.string().max(2000).default(""),
  answers: z.record(z.string(), z.array(z.string().max(60)).max(6)).default({}),
  preferences: z.array(z.string().max(40)).max(20).default([]),
  trip: z.object({
    home: z.string().length(3),
    departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.number().int().min(1).max(9),
    cabin: z.string().max(20),
    returnHome: z.boolean(),
    stops: z.array(z.object({ city: z.string().length(3), nights: z.number().int().min(1).max(30) })).max(10),
    modes: z.array(z.string().max(10)).max(10),
    saved: z.record(z.string(), z.array(z.string().max(120)).max(40)).default({}),
  }),
});
export type PlanRequest = z.infer<typeof PlanRequest>;

export interface SavedPlan {
  createdAt: string;
  source: "gemini" | "sample";
  request: string;
  preferences: string[];
  answers: Record<string, string[]>;
  /** Stops the plan was written for, to flag it as out of date if the route changes. */
  forStops: string;
  response: PlanResponse;
  /** Official entry-rule links for the countries on the route. */
  official?: { country: string; links: { label: string; url: string }[] }[];
  /** The Gemini model(s) that wrote the plan, primary first. */
  models?: string[];
  /** True when a backup model wrote some or all of it. */
  usedBackup?: boolean;
  /** Anything the traveller should know about this plan (e.g. days that couldn't be written). */
  notice?: string;
}
