import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetModelCache } from "../ai/models";
import { createGemini, QUOTA_MESSAGE } from "../ai/provider";
import { SwapRequest } from "../ai/schema";
import type { Place, PlacesResult } from "../places/types";

const guide: Place[] = [
  { id: "m1", category: "eat", name: "Da Dong", lat: 39.9327, lon: 116.4336, tier: "Splurge" },
  { id: "m2", category: "eat", name: "Noodle Loft", lat: 39.94, lon: 116.41 },
  { id: "m3", category: "eat", name: "Duck de Chine", lat: 39.92, lon: 116.45 },
  { id: "m4", category: "eat", name: "Jing Yaa Tang", lat: 39.93, lon: 116.44 },
  { id: "s1", category: "see", name: "Lama Temple", lat: 39.9473, lon: 116.4177 },
  { id: "s2", category: "see", name: "Temple of Heaven", lat: 39.8822, lon: 116.4066 },
];
vi.mock("../places/wikivoyage", () => ({
  cityPlaces: async (city: string): Promise<PlacesResult> => ({
    city, source: "wikivoyage", articleTitle: "Beijing", articleUrl: "https://en.wikivoyage.org/wiki/Beijing", places: guide, fetchedAt: "2026-11-01T00:00:00Z",
  }),
}));

const { POST } = await import("@/app/api/plan/swap/route");
const { POST: ratingsPOST } = await import("@/app/api/plan/ratings/route");
const { swapItem } = await import("../ai/swap");
const { placeRatings, resetRatingsState } = await import("../places/ratings");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const gemini = (text: string) => json({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });
const quota = () => json({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } }, 429);

const BODY = {
  city: "BJS",
  date: "2027-04-10",
  request: "Food and temples",
  preferences: ["Food & markets"],
  dayTitle: "Hutongs",
  dayItems: [
    { time: "Morning", title: "Lama Temple", kind: "see", placeName: "Lama Temple" },
    { time: "Evening", title: "Dinner at Da Dong", kind: "eat", placeName: "Da Dong" },
  ],
  item: { time: "Evening", title: "Dinner at Da Dong", kind: "eat", placeName: "Da Dong", note: "Roast duck." },
  used: ["Da Dong", "Lama Temple"],
  saved: ["Jing Yaa Tang"],
};
const post = (body: unknown, signal?: AbortSignal) =>
  POST(new Request("http://localhost/api/plan/swap", { method: "POST", body: JSON.stringify(body), signal }));

let prompts: string[] = [];
function mockFetch(handler: (n: number) => Response) {
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      prompts.push(JSON.parse(String(init?.body)).contents[0].parts[0].text);
      return handler(n++);
    }),
  );
}

beforeEach(() => {
  prompts = [];
  resetModelCache();
  resetRatingsState();
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
  vi.stubEnv("GEMINI_FALLBACK_MODELS", "gemini-2.0-flash"); // explicit chain: no ListModels call
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/plan/swap", () => {
  it("returns up to three alternatives, linked to the guide and without repeats", async () => {
    mockFetch(() =>
      gemini(
        JSON.stringify({
          options: [
            { title: "Dinner at Da Dong", kind: "eat", placeName: "Da Dong", note: "Same again." }, // already planned
            { title: "Dinner at noodle loft", kind: "eat", placeName: "noodle loft", note: "Hand-pulled noodles." },
            { title: "Duck at Duck de Chine", kind: "eat", placeName: "Duck de Chine" },
            { title: "A quiet dumpling house", kind: "eat", placeName: "Made Up Dumplings" }, // not in the guide
            { title: "Jing Yaa Tang tasting", kind: "eat", placeName: "Jing Yaa Tang" },
          ],
        }),
      ),
    );
    const res = await post(BODY);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.source).toBe("gemini");
    expect(j.options).toHaveLength(3);
    expect(j.options.map((o: { placeName?: string }) => o.placeName)).toEqual(["Noodle Loft", "Duck de Chine", undefined]);
    expect(j.options.every((o: { kind: string }) => o.kind === "eat")).toBe(true);
    expect(JSON.stringify(j.options)).not.toMatch(/Same again/);

    // The model was shown the day, what to avoid, the saved places and the candidates.
    const sent = prompts[0];
    expect(sent).toMatch(/Replace this item: Evening: Dinner at Da Dong \(eat\)/);
    expect(sent).toMatch(/Already in the plan \(do not repeat\): Da Dong; Lama Temple/);
    expect(sent).toMatch(/saved places in Beijing: Jing Yaa Tang/);
    expect(sent).toMatch(/Noodle Loft/);
    expect(sent).toMatch(/Duck de Chine/);
    expect(sent).not.toMatch(/Candidate places[\s\S]*Temple of Heaven/); // a sight is not a dinner candidate
    expect(sent).toMatch(/Candidate places[\s\S]*Noodle Loft \[[^\]]*\] - \d/); // with distance from the rest of the day
  });

  it("includes ratings the server already remembers, and spends no lookups doing so", async () => {
    // Prime the in-memory cache the way the city guide does.
    const lookup = vi.fn(async (p: Place) => ({ rating: p.id === "m2" ? 4.6 : 4.1, count: 1200, reviews: [] }));
    await placeRatings("BJS", ["m2", "m3"], { info: { id: "google", name: "Google Maps", showOnMap: false }, lookup });
    expect(lookup).toHaveBeenCalledTimes(2);

    mockFetch(() => gemini(JSON.stringify({ options: [{ title: "Noodles", kind: "eat", placeName: "Noodle Loft" }, { title: "Duck", kind: "eat", placeName: "Duck de Chine" }] })));
    const j = await (await post(BODY)).json();
    expect(prompts[0]).toMatch(/Noodle Loft \[[^\]]*★4\.6 \(1,200\)\]/);
    expect(j.options[0].rating).toEqual({ rating: 4.6, count: 1200 });
    expect(lookup).toHaveBeenCalledTimes(2); // nothing new was looked up

    const r = await ratingsPOST(new Request("http://localhost/api/plan/ratings", { method: "POST", body: JSON.stringify({ places: [{ city: "BJS", name: "noodle loft" }, { city: "BJS", name: "Lama Temple" }] }) }));
    expect((await r.json()).ratings).toEqual({ "BJS|noodle loft": { rating: 4.6, count: 1200 } });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("falls back to a backup model when the first is out of quota", async () => {
    mockFetch((n) => (n === 0 ? quota() : gemini(JSON.stringify({ options: [{ title: "Noodles", kind: "eat", placeName: "Noodle Loft" }] }))));
    const res = await post(BODY);
    expect(res.status).toBe(200);
    expect((await res.json()).options[0].placeName).toBe("Noodle Loft");
    expect(prompts).toHaveLength(2);
  });

  it("answers with the friendly quota message when every model is out of quota", async () => {
    mockFetch(() => quota());
    const res = await post(BODY);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe(QUOTA_MESSAGE);
  });

  it("says Gemini is busy when it keeps failing with 503 (retries and backups, without waiting)", async () => {
    mockFetch(() => json({ error: { code: 503, status: "UNAVAILABLE", message: "This model is currently experiencing high demand." } }, 503));
    const provider = createGemini({ apiKey: "k", model: "gemini-2.5-flash", fallbacks: ["gemini-2.0-flash"], sleep: async () => {} });
    const err = await swapItem(SwapRequest.parse(BODY), provider, guide).catch((e) => e);
    expect(err).toMatchObject({ status: 503, code: "busy" });
    expect(err.message).toMatch(/busy/i);
    expect(prompts).toHaveLength(6); // 3 tries on each of 2 models
  });

  it("retries once on a malformed reply, then gives a plain error", async () => {
    mockFetch(() => gemini("Sure! Here are some ideas: 1. noodles"));
    const res = await post(BODY);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/didn't match the expected format/);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toMatch(/previous reply could not be used/);
  });

  it("recovers when the retry is well-formed", async () => {
    mockFetch((n) => (n === 0 ? gemini('{"options": "none"}') : gemini(JSON.stringify({ options: [{ title: "Noodles", kind: "eat", placeName: "Noodle Loft" }] }))));
    const res = await post(BODY);
    expect(res.status).toBe(200);
    expect(prompts).toHaveLength(2);
  });

  it("offers guide listings, labelled as such, when there is no AI key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const j = await (await post(BODY)).json();
    expect(j.source).toBe("sample");
    expect(j.notice).toMatch(/Gemini key/);
    const names = j.options.map((o: { placeName: string }) => o.placeName);
    expect(names).toHaveLength(3);
    expect(names).not.toContain("Da Dong");
    expect(names.every((n: string) => ["Noodle Loft", "Duck de Chine", "Jing Yaa Tang"].includes(n))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unreadable requests, unknown cities and travel items", async () => {
    mockFetch(() => gemini("{}"));
    expect((await post({ nonsense: true })).status).toBe(400);
    expect((await post({ ...BODY, city: "ZZZ" })).status).toBe(400);
    const travel = await post({ ...BODY, item: { time: "Morning", title: "Train to Xi'an", kind: "travel" } });
    expect(travel.status).toBe(400);
    expect(prompts).toHaveLength(0);
  });
});
