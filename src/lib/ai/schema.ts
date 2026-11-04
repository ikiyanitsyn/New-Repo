import { z } from "zod";

/** What the concierge sends back. Every AI response is validated against this before use. */

export const ItemKind = z.enum(["see", "do", "eat", "drink", "stay", "travel", "free"]);

export const PlanItem = z.object({
  time: z.string().max(20), // "Morning", "Afternoon", "Evening" or "09:30"
  title: z.string().max(120),
  kind: ItemKind,
  placeName: z.string().max(120).optional(),
  note: z.string().max(400).optional(),
});

export const PlanDay = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().length(3),
  title: z.string().max(120),
  items: z.array(PlanItem).max(8),
});

export const Question = z.object({
  id: z.string().max(40),
  question: z.string().max(160),
  options: z.array(z.string().max(60)).min(2).max(6),
  multi: z.boolean().default(false),
});

export const BeforeYouGo = z.object({
  topic: z.string().max(40),
  summary: z.string().max(300),
  details: z.array(z.string().max(300)).max(6).default([]),
  important: z.boolean().default(false),
});

export const RouteSuggestion = z.object({
  reason: z.string().max(400),
  stops: z.array(z.object({ city: z.string().length(3), nights: z.number().int().min(1).max(30) })).min(1).max(8),
});

export const PlanResponse = z.object({
  title: z.string().max(80),
  summary: z.string().max(600),
  questions: z.array(Question).max(4).default([]),
  routeSuggestion: RouteSuggestion.nullish(),
  days: z.array(PlanDay).max(30).default([]),
  beforeYouGo: z.array(BeforeYouGo).max(10).default([]),
});

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
}
