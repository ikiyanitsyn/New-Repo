import "server-only";
import { findCity, getCity } from "../cities";
import { cityPlaces } from "../places/wikivoyage";
import { featureScore } from "../places/subcategory";
import type { Place } from "../places/types";
import { officialLinks } from "./official";
import { buildDaysPrompt, buildOverviewPrompt, chunkSlots, dayRangeLabel, daySlots, type SlotChunk } from "./prompt";
import { AiError, getProvider, type AiProvider, type ProviderEvent } from "./provider";
import { DaysReply, PlanResponse, type PlanDay, type PlanRequest } from "./schema";

export interface PlanResult {
  source: "gemini" | "sample";
  response: PlanResponse;
  official: ReturnType<typeof officialLinks>;
  notice?: string;
  /** Models that wrote the plan, in the order they first answered. */
  models?: string[];
  /** True when a backup model wrote some or all of the plan. */
  usedBackup?: boolean;
}

/** A short, honest line about what the planner is doing right now. */
export interface PlanProgress {
  message: string;
  done: number;
  total: number;
}

export interface PlanOptions {
  /** Cancels everything (e.g. the browser went away or the traveller tapped Cancel). */
  signal?: AbortSignal;
  onProgress?: (p: PlanProgress) => void;
  /** Whole-request time budget. After it, unfinished parts are dropped and the rest returned. */
  budgetMs?: number;
  /** Time limit for each single model call. */
  callTimeoutMs?: number;
  /** How many model calls run at once (free tiers limit requests per minute). */
  concurrency?: number;
}

export const PLAN_BUDGET_MS = 75_000;
export const CALL_TIMEOUT_MS = 40_000;
export const PLAN_CONCURRENCY = 3;

/** Pull the JSON object out of a model reply, tolerating stray code fences. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in the reply");
  return JSON.parse(t.slice(start, end + 1));
}

/** Keep only what the planner can show: known cities, the right dates, valid route stops. */
export function sanitize(resp: PlanResponse, r: PlanRequest): PlanResponse {
  const slots = daySlots(r);
  const slotDates = new Set(slots.map((s) => s.date));
  return {
    ...resp,
    days: slots.length ? resp.days.filter((d) => slotDates.has(d.date) && findCity(d.city)) : [],
    routeSuggestion: resp.routeSuggestion
      ? { ...resp.routeSuggestion, stops: resp.routeSuggestion.stops.filter((s) => findCity(s.city) && findCity(s.city)!.country !== "US") }
      : null,
  };
}

/** Run tasks with at most `limit` in flight. Results keep the input order. */
export async function runLimited<T>(tasks: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/** Match a chunk reply to its slots: by date, or by position if the model got the dates wrong. */
export function fitDays(days: PlanDay[], chunk: SlotChunk): (PlanDay | null)[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const anyDateMatch = chunk.slots.some((s) => byDate.has(s.date));
  return chunk.slots.map((s, i) => {
    const d = byDate.get(s.date) ?? (!anyDateMatch && days.length === chunk.slots.length ? days[i] : undefined);
    return d ? { ...d, date: s.date, city: s.city } : null;
  });
}

/** Group 0-based indices into "Days 6–9" style labels. */
export function missingLabel(indices: number[]): string {
  const sorted = [...indices].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const i of sorted) {
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  }
  const labels = runs.map(([a, b], k) => {
    const l = dayRangeLabel(a, b - a + 1);
    return k === 0 ? l : l.replace(/^Days?/, (w) => w.toLowerCase());
  });
  return labels.length <= 2 ? labels.join(" and ") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/** A place shouldn't be planned twice in the same city (parts are written in parallel). */
function dropRepeats(days: PlanDay[]): PlanDay[] {
  const seen = new Map<string, Set<string>>();
  return days.map((d) => {
    const used = seen.get(d.city) ?? new Set<string>();
    seen.set(d.city, used);
    const items = d.items.filter((it) => {
      const key = it.placeName?.trim().toLowerCase();
      if (!key) return true;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    });
    return { ...d, items: items.length ? items : d.items };
  });
}

const ABORTED = (e: unknown) => e instanceof AiError && e.code === "aborted";

/**
 * Write the plan with the AI: one overview call plus one call per chunk of up to ~5 days,
 * run concurrently (at most 3 at a time). Each part retries and falls back on its own; parts
 * that fail or run past the time budget are left out with a notice, and the rest is returned.
 */
export async function writePlan(
  r: PlanRequest,
  provider: AiProvider,
  placesByCity: Record<string, Place[]>,
  opts: PlanOptions = {},
): Promise<Omit<PlanResult, "official">> {
  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(), opts.budgetMs ?? PLAN_BUDGET_MS);
  const signal = opts.signal ? AbortSignal.any([budget.signal, opts.signal]) : budget.signal;
  const callTimeoutMs = opts.callTimeoutMs ?? CALL_TIMEOUT_MS;

  const slots = daySlots(r);
  const chunks = chunkSlots(slots);
  const total = chunks.length + 1;
  let done = 0;
  const inflight: string[] = [];
  const answered: { model: string; backup: boolean }[] = [];

  const report = (message?: string) => {
    const days = inflight.find((l) => l !== "overview");
    const msg = message ?? (days ? `Writing ${days.toLowerCase()}…` : inflight.length ? "Writing the overview and travel brief…" : "Putting it together…");
    opts.onProgress?.({ message: msg, done, total });
  };
  const onEvent = (e: ProviderEvent) => {
    if (e.type === "retry") report("Gemini is busy. Trying again in a moment…");
    else report(e.reason === "quota" ? "A model hit its free limit. Switching to a backup…" : "Gemini is busy. Switching to a backup model…");
  };

  /** Ask once, and once more with the error if the reply can't be used. */
  async function ask<T>(prompt: { system: string; user: string }, read: (raw: unknown) => T | null): Promise<T> {
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const extra = attempt ? `\n\nYour previous reply could not be used (${lastError}). Reply again with valid JSON matching the shape exactly.` : "";
      const res = await provider.generateJson(prompt.system, prompt.user + extra, { signal, timeoutMs: callTimeoutMs, onEvent });
      try {
        const value = read(extractJson(res.text));
        if (value !== null) {
          answered.push({ model: res.model, backup: res.backup });
          return value;
        }
        lastError = "it was missing the requested content";
      } catch (e) {
        lastError = e instanceof Error ? e.message.slice(0, 200) : "invalid JSON";
      }
    }
    throw new AiError(`The AI reply didn't match the expected format (${lastError}).`, 502, "empty");
  }

  const track = <T>(label: string, fn: () => Promise<T>) => async () => {
    if (signal.aborted) throw new AiError("Out of time.", 504, "timeout");
    inflight.push(label);
    report();
    try {
      return await fn();
    } finally {
      inflight.splice(inflight.indexOf(label), 1);
      done++;
      report();
    }
  };

  const overviewTask = track("overview", () =>
    ask(buildOverviewPrompt(r), (raw) => {
      const p = PlanResponse.safeParse(raw);
      if (!p.success) return null;
      const o = sanitize({ ...p.data, days: [] }, r);
      return o.title || o.summary || o.beforeYouGo.length || o.routeSuggestion ? o : null;
    }),
  );
  const dayTasks = chunks.map((c) =>
    track(dayRangeLabel(c.start, c.slots.length), () =>
      ask(buildDaysPrompt(r, c, placesByCity), (raw) => {
        const p = DaysReply.safeParse(raw);
        if (!p.success) return null;
        const fitted = fitDays(p.data.days.filter((d) => findCity(d.city)), c);
        return fitted.some(Boolean) ? fitted : null;
      }),
    ),
  );

  let results: PromiseSettledResult<unknown>[];
  try {
    results = await runLimited<unknown>([overviewTask, ...dayTasks], opts.concurrency ?? PLAN_CONCURRENCY);
  } finally {
    clearTimeout(budgetTimer);
  }
  if (opts.signal?.aborted) throw new AiError("The request was cancelled.", 499, "aborted");
  const timedOut = budget.signal.aborted;

  const [overviewRes, ...dayRes] = results;
  const days: (PlanDay | null)[] = new Array(slots.length).fill(null);
  dayRes.forEach((res, k) => {
    if (res.status !== "fulfilled") return;
    (res.value as (PlanDay | null)[]).forEach((d, i) => (days[chunks[k].start + i] = d));
  });
  const written = days.filter((d): d is PlanDay => d !== null);
  const overview = overviewRes.status === "fulfilled" ? (overviewRes.value as PlanResponse) : null;

  if (!overview && !written.length) {
    const errors = results.map((x) => (x.status === "rejected" ? x.reason : null)).filter(Boolean);
    const best =
      errors.find((e) => e instanceof AiError && ["auth", "quota", "missing"].includes(e.code ?? "")) ??
      errors.find((e) => e instanceof AiError && !ABORTED(e) && e.code !== "timeout") ??
      errors[0];
    if (timedOut) throw new AiError("Gemini took too long to answer. Wait a moment, then try again.", 504, "timeout");
    throw best instanceof AiError ? best : new AiError(best instanceof Error ? best.message : "The planner couldn't finish. Try again.");
  }

  const notices: string[] = [];
  const missing = days.flatMap((d, i) => (d ? [] : [i]));
  if (missing.length) notices.push(`${missingLabel(missing)} couldn't be written${timedOut ? " in time" : ""}.`);
  if (!overview) notices.push(`The trip summary and "Before you go" brief couldn't be written${timedOut ? " in time" : ""}.`);
  if (notices.length) notices.push("Tap Update to try again.");

  const models = [...new Set(answered.map((a) => a.model))].sort((a, b) => Number(a !== provider.primaryModel) - Number(b !== provider.primaryModel));
  const cities = [...new Set(slots.map((s) => getCity(s.city).name))];
  const response: PlanResponse = {
    title: overview?.title || (cities.length ? `${cities.join(", ")}` : "Your itinerary"),
    summary: overview?.summary ?? "",
    questions: overview?.questions ?? [],
    routeSuggestion: overview?.routeSuggestion ?? null,
    beforeYouGo: overview?.beforeYouGo ?? [],
    days: dropRepeats(written),
  };
  return {
    source: "gemini",
    response,
    notice: notices.length ? notices.join(" ") : undefined,
    models,
    usedBackup: answered.some((a) => a.backup),
  };
}

export async function makePlan(r: PlanRequest, opts: PlanOptions = {}): Promise<PlanResult> {
  const startedAt = Date.now();
  const cities = [...new Set(r.trip.stops.map((s) => s.city))];
  const official = officialLinks(cities);
  opts.onProgress?.({ message: "Reading the city guides…", done: 0, total: 1 });
  const guides = await Promise.all(cities.map((c) => cityPlaces(c)));
  const placesByCity = Object.fromEntries(guides.map((g) => [g.city, g.places]));

  const provider = getProvider();
  if (!provider) {
    return { source: "sample", response: samplePlan(r, placesByCity), official, notice: "Sample plan. Add a Gemini key to get a personal itinerary (docs/SETUP_GUIDE.md)." };
  }
  // The time budget covers the whole request, guide lookups included.
  const budgetMs = Math.max(15_000, (opts.budgetMs ?? PLAN_BUDGET_MS) - (Date.now() - startedAt));
  return { ...(await writePlan(r, provider, placesByCity, { ...opts, budgetMs })), official };
}

/** A plausible plan built from guide listings, used when no AI key is configured. */
export function samplePlan(r: PlanRequest, placesByCity: Record<string, Place[]>): PlanResponse {
  const slots = daySlots(r);
  const used = new Set<string>();
  const take = (city: string, cats: Place["category"][]) => {
    const p = (placesByCity[city] ?? [])
      .filter((x) => cats.includes(x.category) && !used.has(x.name))
      .sort((a, b) => featureScore(b) - featureScore(a))[0];
    if (p) used.add(p.name);
    return p;
  };
  const days = slots.map((s, i) => {
    const city = getCity(s.city);
    const items: PlanResponse["days"][number]["items"] = [];
    if (s.note) items.push({ time: "Morning", title: s.note[0].toUpperCase() + s.note.slice(1), kind: "travel" });
    const isLast = i === slots.length - 1;
    if (!isLast) {
      const sight = take(s.city, ["see"]);
      items.push(sight ? { time: "Afternoon", title: sight.name, kind: "see", placeName: sight.name } : { time: "Afternoon", title: `Walk the centre of ${city.name}`, kind: "see" });
      const meal = take(s.city, ["eat"]);
      items.push(meal ? { time: "Evening", title: `Dinner at ${meal.name}`, kind: "eat", placeName: meal.name } : { time: "Evening", title: "Dinner nearby", kind: "eat" });
      if (!s.note) {
        const act = take(s.city, ["do", "see"]);
        if (act) items.unshift({ time: "Morning", title: act.name, kind: act.category === "do" ? "do" : "see", placeName: act.name });
      }
    }
    return { date: s.date, city: s.city, title: isLast ? "Departure" : s.note ? `Arrive in ${city.name}` : `${city.name} at your own pace`, items };
  });
  return {
    title: "Sample itinerary",
    summary: "This sample plan is built from the city guides. Add a Gemini key to get a personal itinerary written for your interests.",
    questions: [
      { id: "interests", question: "What should the trip focus on?", options: ["Food", "History & temples", "Art & design", "Nature", "Nightlife", "Shopping"], multi: true },
      { id: "pace", question: "How full should the days be?", options: ["Relaxed", "Balanced", "Packed"], multi: false },
      { id: "budget", question: "What level of comfort?", options: ["Good value", "Comfortable", "Luxury"], multi: false },
    ],
    routeSuggestion: r.trip.stops.length ? null : { reason: "A classic first trip: imperial Beijing, the Terracotta Army in Xi'an, pandas and spice in Chengdu, then Shanghai and Hong Kong.", stops: [{ city: "BJS", nights: 4 }, { city: "SIA", nights: 2 }, { city: "CTU", nights: 3 }, { city: "SHA", nights: 3 }, { city: "HKG", nights: 3 }] },
    days,
    beforeYouGo: [
      { topic: "Visa & entry", summary: "Entry rules for US passport holders differ by country and change often. Check the official pages linked below before booking.", details: [], important: true },
      { topic: "Money & payments", summary: "Carry a card without foreign transaction fees and a little local cash.", details: [], important: false },
      { topic: "Phone & internet", summary: "An eSIM or roaming plan keeps maps and translation working from the moment you land.", details: [], important: false },
    ],
  };
}
