import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildChain, discoverBackups, pickFlashModels, resetModelCache } from "../ai/models";
import { AiError, createGemini, QUOTA_MESSAGE, type AiProvider } from "../ai/provider";
import { chunkSlots, daySlots } from "../ai/prompt";
import { missingLabel, runLimited, writePlan } from "../ai/plan";
import { PlanRequest, PlanResponse } from "../ai/schema";

const LIST = {
  models: [
    { name: "models/gemini-2.0-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
    { name: "models/gemini-2.0-flash-001", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-2.5-flash-image", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-2.5-flash-preview-tts", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-live-2.5-flash", supportedGenerationMethods: ["bidiGenerateContent"] },
    { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.6-flash-preview", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-flash-latest", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const reply = (text: string) => json({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });
const apiError = (status: number, apiStatus: string, message: string) => json({ error: { code: status, status: apiStatus, message } }, status);
const HIGH_DEMAND = "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.";

/** A fetch mock that answers ListModels and routes generateContent calls by model name. */
function mockGemini(byModel: Record<string, () => Response>) {
  const calls: { model: string; body: { generationConfig: { thinkingConfig?: Record<string, unknown> } } }[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (!u.includes(":generateContent")) return json(LIST);
    const model = decodeURIComponent(/models\/([^:]+):/.exec(u)![1]);
    calls.push({ model, body: JSON.parse(String(init?.body)) });
    const handler = byModel[model];
    return handler ? handler() : apiError(404, "NOT_FOUND", `models/${model} is not found`);
  });
  return { fetchMock: fetchMock as unknown as typeof fetch, calls, raw: fetchMock };
}

beforeEach(() => resetModelCache());

describe("model chain", () => {
  it("keeps text Flash models, Flash before Flash-Lite, newest first", () => {
    expect(pickFlashModels(LIST.models)).toEqual([
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-flash-latest",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash-lite",
    ]);
    expect(buildChain("gemini-3.5-flash", pickFlashModels(LIST.models))).toEqual([
      "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-3.5-flash-lite",
    ]);
  });

  it("uses preview models only when nothing else is left", () => {
    expect(pickFlashModels([{ name: "models/gemini-3.6-flash-preview", supportedGenerationMethods: ["generateContent"] }])).toEqual(["gemini-3.6-flash-preview"]);
  });

  it("discovers with ListModels using the key header, and caches the list", async () => {
    const { fetchMock, raw } = mockGemini({});
    const a = await discoverBackups("key-123", fetchMock);
    const b = await discoverBackups("key-123", fetchMock);
    expect(a).toEqual(b);
    expect(a[0]).toBe("gemini-3.5-flash");
    expect(raw).toHaveBeenCalledTimes(1);
    const [url, init] = raw.mock.calls[0];
    expect(String(url)).toMatch(/v1beta\/models\?/);
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("key-123");
  });
});

describe("Gemini retry and fallback", () => {
  const noSleep = vi.fn(async () => {});
  beforeEach(() => noSleep.mockClear());

  it("backs off on 503, then answers from the backup model", async () => {
    const { fetchMock, calls } = mockGemini({
      "gemini-3.5-flash": () => apiError(503, "UNAVAILABLE", HIGH_DEMAND),
      "gemini-2.5-flash": () => reply('{"ok":true}'),
    });
    const ai = createGemini({ apiKey: "k", model: "gemini-3.5-flash", fetch: fetchMock, sleep: noSleep, random: () => 0.5 });
    const events: string[] = [];
    const res = await ai.generateJson("sys", "user", { onEvent: (e) => events.push(e.type) });
    expect(res).toEqual({ text: '{"ok":true}', model: "gemini-2.5-flash", backup: true });
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.5-flash", "gemini-3.5-flash", "gemini-3.5-flash", "gemini-2.5-flash"]);
    expect(noSleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([1000, 2000]);
    expect(events).toEqual(["retry", "retry", "switch"]);
    // Thinking is turned down for speed.
    expect(calls[0].body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(calls[3].body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("tries the overloaded model last on the next call in the same request", async () => {
    const { fetchMock, calls } = mockGemini({
      "gemini-3.5-flash": () => apiError(503, "UNAVAILABLE", HIGH_DEMAND),
      "gemini-2.5-flash": () => reply("{}"),
    });
    const ai = createGemini({ apiKey: "k", model: "gemini-3.5-flash", fetch: fetchMock, sleep: noSleep });
    await ai.generateJson("s", "u");
    calls.length = 0;
    await ai.generateJson("s", "u");
    expect(calls.map((c) => c.model)).toEqual(["gemini-2.5-flash"]);
  });

  it("moves to the next model straight away on 429, and remembers it", async () => {
    const { fetchMock, calls } = mockGemini({
      "gemini-3.5-flash": () => apiError(429, "RESOURCE_EXHAUSTED", "Quota exceeded"),
      "gemini-2.5-flash": () => reply("{}"),
    });
    const ai = createGemini({ apiKey: "k", model: "gemini-3.5-flash", fetch: fetchMock, sleep: noSleep });
    expect((await ai.generateJson("s", "u")).model).toBe("gemini-2.5-flash");
    expect(noSleep).not.toHaveBeenCalled();
    calls.length = 0;
    await ai.generateJson("s", "u");
    expect(calls.map((c) => c.model)).toEqual(["gemini-2.5-flash"]);
  });

  it("gives the friendly quota message when every model is limited", async () => {
    const limited = () => apiError(429, "RESOURCE_EXHAUSTED", "Quota exceeded");
    const { fetchMock } = mockGemini({ a: limited, b: limited, c: limited });
    const ai = createGemini({ apiKey: "k", model: "a", fallbacks: ["b", "c", "gone"], fetch: fetchMock, sleep: noSleep });
    const err = await ai.generateJson("s", "u").catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(QUOTA_MESSAGE);
    expect(err.status).toBe(429);
  });

  it("skips models that aren't found and uses GEMINI_FALLBACK_MODELS order", async () => {
    const { fetchMock, calls, raw } = mockGemini({ "gemini-2.5-flash-lite": () => reply("{}") });
    const ai = createGemini({ apiKey: "k", model: "gemini-9-flash", fallbacks: ["gemini-2.5-flash-lite"], fetch: fetchMock, sleep: noSleep });
    expect((await ai.generateJson("s", "u")).model).toBe("gemini-2.5-flash-lite");
    expect(calls.map((c) => c.model)).toEqual(["gemini-9-flash", "gemini-2.5-flash-lite"]);
    expect(raw.mock.calls.every((c) => String(c[0]).includes(":generateContent"))).toBe(true); // no ListModels
  });

  it("retries once without thinkingConfig when the model rejects it", async () => {
    let n = 0;
    const { fetchMock, calls } = mockGemini({
      "gemini-3.5-flash": () => (n++ === 0 ? apiError(400, "INVALID_ARGUMENT", "Thinking level is not supported for this model.") : reply("{}")),
    });
    const ai = createGemini({ apiKey: "k", model: "gemini-3.5-flash", fallbacks: [], fetch: fetchMock, sleep: noSleep });
    expect((await ai.generateJson("s", "u")).backup).toBe(false);
    expect(calls).toHaveLength(2);
    expect(calls[1].body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it("stops at once for a bad API key", async () => {
    const { fetchMock, calls } = mockGemini({ a: () => apiError(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.") });
    const ai = createGemini({ apiKey: "k", model: "a", fallbacks: ["b"], fetch: fetchMock, sleep: noSleep });
    const err = await ai.generateJson("s", "u").catch((e) => e);
    expect(err.code).toBe("auth");
    expect(calls).toHaveLength(1);
  });
});

describe("lenient reply schema", () => {
  it("trims over-long text instead of rejecting the reply", () => {
    const long = "Would you rather spend your free afternoons wandering the hutongs, ".repeat(5).slice(0, 300);
    const p = PlanResponse.safeParse({ title: "T", summary: "S", questions: [{ id: "q", question: long, options: ["Yes", "No"] }] });
    expect(p.success).toBe(true);
    const q = p.data!.questions[0].question;
    expect(q.length).toBeLessThanOrEqual(160);
    expect(q.endsWith("…")).toBe(true);
    expect(q).not.toMatch(/\s…$/);
  });

  it("drops bad items, slices long lists and maps unknown kinds", () => {
    const p = PlanResponse.parse({
      title: "T",
      summary: "S",
      questions: [
        { id: "one", question: "Only one option?", options: ["Yes"] },
        ...Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, question: `Q${i}`, options: ["a", "b"] })),
      ],
      days: [
        { date: "April 9", city: "BJS", title: "bad date", items: [] },
        { date: "2027-04-09", city: "bjs", title: "ok", items: [{ time: "Morning", title: "Temple", kind: "sightseeing" }, { time: "Noon", title: "Mystery", kind: "wander" }, { kind: "eat" }] },
      ],
    });
    expect(p.questions.map((q) => q.id)).toEqual(["q0", "q1", "q2", "q3"]);
    expect(p.days).toHaveLength(1);
    expect(p.days[0].city).toBe("BJS");
    expect(p.days[0].items.map((i) => i.kind)).toEqual(["see", "see"]);
  });

  it("keeps PlanRequest strict", () => {
    expect(PlanRequest.safeParse({ request: "x".repeat(2001), trip: {} }).success).toBe(false);
  });
});

const fiveCities = PlanRequest.parse({
  request: "First time in China",
  trip: {
    home: "NYC", departDate: "2027-04-08", adults: 2, cabin: "economy", returnHome: true,
    stops: [{ city: "BJS", nights: 3 }, { city: "SIA", nights: 3 }, { city: "CTU", nights: 3 }, { city: "SHA", nights: 3 }, { city: "HKG", nights: 2 }],
    modes: ["train", "train", "flight", "flight"],
  },
});

describe("chunking", () => {
  it("splits 15 days over 5 cities into chunks of at most 5 within one city", () => {
    const slots = daySlots(fiveCities);
    expect(slots).toHaveLength(15);
    const chunks = chunkSlots(slots);
    for (const c of chunks) {
      expect(c.slots.length).toBeLessThanOrEqual(5);
      expect(new Set(c.slots.map((s) => s.city)).size).toBe(1);
    }
    expect(chunks.flatMap((c) => c.slots)).toEqual(slots);
    expect(chunks.map((c) => c.start)).toEqual([0, 3, 6, 9, 12]);
  });

  it("splits a long stay evenly", () => {
    const long = PlanRequest.parse({ ...fiveCities, trip: { ...fiveCities.trip, stops: [{ city: "BJS", nights: 8 }] } });
    const chunks = chunkSlots(daySlots(long));
    expect(chunks.map((c) => c.slots.length)).toEqual([5, 4]); // 8 nights + departure day
    expect(chunks.map((c) => `${c.part}/${c.parts}`)).toEqual(["0/2", "1/2"]);
  });

  it("labels missing days", () => {
    expect(missingLabel([5, 6, 7, 8])).toBe("Days 6–9");
    expect(missingLabel([0, 5, 6])).toBe("Day 1 and days 6–7");
  });
});

/** A fake model: writes valid days for whatever slots the prompt lists, unless told to fail. */
function fakeProvider(opts: { failDays?: (user: string) => boolean; hangDays?: boolean } = {}) {
  let inFlight = 0;
  let maxInFlight = 0;
  const provider: AiProvider = {
    name: "gemini",
    primaryModel: "gemini-3.5-flash",
    async generateJson(system, user, o) {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise((r) => setTimeout(r, 5));
        if (!system.includes('"days": [')) {
          return { text: JSON.stringify({ title: "Imperial China", summary: "A calm first trip.", questions: [], routeSuggestion: null, beforeYouGo: [{ topic: "Visa & entry", summary: "Check.", important: true }] }), model: "gemini-3.5-flash", backup: false };
        }
        if (opts.hangDays) {
          await new Promise((_, reject) => o?.signal?.addEventListener("abort", () => reject(new AiError("The request was cancelled.", 499, "aborted"))));
        }
        if (opts.failDays?.(user)) throw new AiError("Gemini is very busy right now.", 503, "busy");
        const days = [...user.matchAll(/Day \d+: (\d{4}-\d{2}-\d{2}) in ([A-Z]{3})/g)].map(([, date, city]) => ({
          date, city, title: "A day", items: [{ time: "Morning", title: "Walk", kind: "see", note: "Short." }],
        }));
        return { text: JSON.stringify({ days }), model: "gemini-2.5-flash", backup: true };
      } finally {
        inFlight--;
      }
    },
  };
  return { provider, maxInFlight: () => maxInFlight };
}

describe("parallel plan writing", () => {
  it("writes every part, at most 3 at a time, in the same PlanResponse shape", async () => {
    const { provider, maxInFlight } = fakeProvider();
    const res = await writePlan(fiveCities, provider, {});
    expect(PlanResponse.safeParse(res.response).success).toBe(true);
    expect(res.response.title).toBe("Imperial China");
    expect(res.response.days.map((d) => d.date)).toEqual(daySlots(fiveCities).map((s) => s.date));
    expect(res.notice).toBeUndefined();
    expect(maxInFlight()).toBeLessThanOrEqual(3);
    expect(res.models).toEqual(["gemini-3.5-flash", "gemini-2.5-flash"]);
    expect(res.usedBackup).toBe(true);
  });

  it("returns the rest with a notice when one day chunk fails", async () => {
    const { provider } = fakeProvider({ failDays: (u) => u.includes("Day 4:") });
    const res = await writePlan(fiveCities, provider, {});
    expect(res.response.days).toHaveLength(12);
    expect(res.notice).toBe("Days 4–6 couldn't be written. Tap Update to try again.");
  });

  it("stops at the time budget and returns what is finished", async () => {
    const { provider } = fakeProvider({ hangDays: true });
    const res = await writePlan(fiveCities, provider, {}, { budgetMs: 100 });
    expect(res.response.title).toBe("Imperial China");
    expect(res.response.days).toHaveLength(0);
    expect(res.notice).toMatch(/Days 1–15 couldn't be written in time/);
  });

  it("throws the clearest error when nothing could be written", async () => {
    const provider: AiProvider = {
      name: "gemini",
      primaryModel: "m",
      generateJson: async () => {
        throw new AiError(QUOTA_MESSAGE, 429, "quota");
      },
    };
    await expect(writePlan(fiveCities, provider, {})).rejects.toMatchObject({ status: 429, message: QUOTA_MESSAGE });
  });

  it("runLimited keeps order and caps concurrency", async () => {
    let live = 0;
    let peak = 0;
    const tasks = Array.from({ length: 7 }, (_, i) => async () => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 3));
      live--;
      if (i === 2) throw new Error("x");
      return i;
    });
    const out = await runLimited(tasks, 3);
    expect(peak).toBe(3);
    expect(out.map((o) => (o.status === "fulfilled" ? o.value : "err"))).toEqual([0, 1, "err", 3, 4, 5, 6]);
  });
});
