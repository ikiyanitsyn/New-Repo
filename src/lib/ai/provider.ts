import "server-only";
import { buildChain, discoverBackups, parseFallbackEnv } from "./models";

/**
 * One small interface for any AI model, so Gemini can be swapped for another
 * provider (e.g. Claude) by adding a file here and changing AI_PROVIDER.
 */
export interface AiProvider {
  name: "gemini";
  /** The model the owner configured (GEMINI_MODEL). */
  primaryModel: string;
  /** Returns the model's raw text (which should be a JSON document) and which model wrote it. */
  generateJson(system: string, user: string, opts?: GenerateOptions): Promise<GenerateResult>;
}

export interface GenerateResult {
  text: string;
  model: string;
  /** True when a backup model answered instead of the configured one. */
  backup: boolean;
}

export type ProviderEvent =
  | { type: "retry"; model: string; attempt: number; delayMs: number }
  | { type: "switch"; from: string; to: string; reason: FailureKind };

export interface GenerateOptions {
  /** Cancels the whole call (all retries and backups). */
  signal?: AbortSignal;
  /** Time limit for each single HTTP request. Default 40s. */
  timeoutMs?: number;
  onEvent?: (e: ProviderEvent) => void;
}

export type AiErrorCode = "quota" | "busy" | "missing" | "auth" | "timeout" | "aborted" | "bad_request" | "empty";

export class AiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: AiErrorCode) {
    super(message);
  }
}

type FailureKind = "quota" | "busy" | "missing" | "thinking" | "auth" | "timeout" | "aborted" | "bad_request" | "empty";

class ModelFailure extends Error {
  constructor(readonly kind: FailureKind, message: string, readonly status?: number) {
    super(message);
  }
}

export const QUOTA_MESSAGE = "The free Gemini quota is used up for now. Wait a minute (or until tomorrow) and try again.";

/** Gemini 3 thinks by default (slow); 2.5 Flash can switch thinking off. */
export function thinkingConfigFor(model: string): Record<string, unknown> | undefined {
  if (model.startsWith("gemini-3")) return { thinkingLevel: "low" };
  if (model.startsWith("gemini-2.5") && model.includes("flash")) return { thinkingBudget: 0 };
  return undefined;
}

/** Sort a Gemini error into what we should do about it. */
export function classify(status: number, apiStatus: string | undefined, message: string): FailureKind {
  const m = message.toLowerCase();
  if (status === 429 || apiStatus === "RESOURCE_EXHAUSTED") return "quota";
  if (status === 404 || apiStatus === "NOT_FOUND") return "missing";
  if (status === 400 && /thinking/.test(m)) return "thinking";
  if (status === 401 || status === 403 || apiStatus === "PERMISSION_DENIED" || apiStatus === "UNAUTHENTICATED" || /api key/.test(m)) return "auth";
  if (status >= 500 || apiStatus === "UNAVAILABLE" || apiStatus === "INTERNAL" || /overloaded|high demand|try again later/.test(m)) return "busy";
  return "bad_request";
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new ModelFailure("aborted", "Cancelled"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new ModelFailure("aborted", "Cancelled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export interface GeminiConfig {
  apiKey: string;
  model: string;
  /** Explicit backups (GEMINI_FALLBACK_MODELS). Undefined means discover them with ListModels. */
  fallbacks?: string[];
  fetch?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  /** Same-model retries for "busy" errors before moving on. Default 2 (about 1s, then 2s). */
  busyRetries?: number;
}

/**
 * A Gemini client that adapts: retries brief overloads with backoff, then moves down a chain
 * of backup models. One instance is made per plan request, so it remembers (for that request)
 * which models are out of quota, missing or overloaded and skips them for the remaining calls.
 */
export function createGemini(cfg: GeminiConfig): AiProvider {
  const doFetch = cfg.fetch ?? fetch;
  const sleep = cfg.sleep ?? defaultSleep;
  const random = cfg.random ?? Math.random;
  const busyRetries = cfg.busyRetries ?? 2;
  const primary = cfg.model.replace(/^models\//, "");

  const dead = new Map<string, FailureKind>(); // out of quota or not found
  const strained = new Set<string>(); // overloaded or slow: tried last
  const noThinking = new Set<string>(); // rejected thinkingConfig
  let chainPromise: Promise<string[]> | null = null;

  const chain = () =>
    (chainPromise ??= (cfg.fallbacks ? Promise.resolve(cfg.fallbacks) : discoverBackups(cfg.apiKey, doFetch)).then((b) => buildChain(primary, b)));

  async function callOnce(model: string, system: string, user: string, signal: AbortSignal | undefined, timeoutMs: number): Promise<string> {
    const thinkingConfig = noThinking.has(model) ? undefined : thinkingConfigFor(model);
    const timeout = AbortSignal.timeout(timeoutMs);
    let res: Response;
    try {
      res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: 8192,
            ...(thinkingConfig ? { thinkingConfig } : {}),
          },
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (e) {
      if (signal?.aborted) throw new ModelFailure("aborted", "Cancelled");
      if (timeout.aborted) throw new ModelFailure("timeout", `${model} took longer than ${Math.round(timeoutMs / 1000)}s`);
      throw new ModelFailure("busy", e instanceof Error ? e.message : "Network error");
    }
    const json = (await res.json().catch(() => ({}))) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      error?: { message?: string; status?: string };
    };
    if (!res.ok) {
      const msg = json.error?.message ?? `Gemini responded ${res.status}`;
      const kind = classify(res.status, json.error?.status, msg);
      if (kind === "thinking" && !thinkingConfig) throw new ModelFailure("bad_request", msg, res.status);
      throw new ModelFailure(kind, msg, res.status);
    }
    const cand = json.candidates?.[0];
    const text = cand?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) throw new ModelFailure("empty", `No text (${cand?.finishReason ?? json.promptFeedback?.blockReason ?? "unknown reason"})`);
    return text;
  }

  return {
    name: "gemini",
    primaryModel: primary,
    async generateJson(system, user, opts = {}) {
      const { signal, onEvent } = opts;
      const timeoutMs = opts.timeoutMs ?? 40_000;
      const all = await chain();
      const live = all.filter((m) => !dead.has(m));
      const order = [...live.filter((m) => !strained.has(m)), ...live.filter((m) => strained.has(m))];
      const seen: FailureKind[] = live.length ? [] : [...dead.values()];

      for (let i = 0; i < order.length; i++) {
        const model = order[i];
        let busyTries = 0;
        let failure: ModelFailure | null = null;
        while (true) {
          if (signal?.aborted) throw new AiError("The request was cancelled.", 499, "aborted");
          try {
            const text = await callOnce(model, system, user, signal, timeoutMs);
            strained.delete(model);
            return { text, model, backup: model !== primary };
          } catch (e) {
            const f = e instanceof ModelFailure ? e : new ModelFailure("busy", e instanceof Error ? e.message : "Request failed");
            if (f.kind === "thinking") {
              noThinking.add(model); // retry once without thinkingConfig
              continue;
            }
            if (f.kind === "busy" && busyTries < busyRetries) {
              const delayMs = Math.round(1000 * 2 ** busyTries * (0.75 + random() * 0.5));
              busyTries++;
              onEvent?.({ type: "retry", model, attempt: busyTries, delayMs });
              try {
                await sleep(delayMs, signal);
              } catch {
                throw new AiError("The request was cancelled.", 499, "aborted");
              }
              continue;
            }
            failure = f;
            break;
          }
        }
        const kind = failure.kind;
        if (kind === "aborted") throw new AiError("The request was cancelled.", 499, "aborted");
        if (kind === "auth") throw new AiError("Gemini didn't accept the API key. Check GEMINI_API_KEY in .env.local (see docs/SETUP_GUIDE.md).", 401, "auth");
        if (kind === "bad_request") throw new AiError(`Gemini couldn't process the request (${failure.message}). Please try again.`, 400, "bad_request");
        seen.push(kind);
        if (kind === "quota" || kind === "missing") dead.set(model, kind);
        else strained.add(model);
        if (order[i + 1]) onEvent?.({ type: "switch", from: model, to: order[i + 1], reason: kind });
      }
      throw exhausted(seen);
    },
  };
}

/** The friendliest accurate message once every model has been tried. */
function exhausted(seen: FailureKind[]): AiError {
  const has = (k: FailureKind) => seen.includes(k);
  if (seen.every((k) => k === "quota" || k === "missing") && has("quota")) return new AiError(QUOTA_MESSAGE, 429, "quota");
  if (seen.every((k) => k === "missing"))
    return new AiError("None of the Gemini models could be found. Set GEMINI_MODEL to a current Flash model (see docs/SETUP_GUIDE.md).", 404, "missing");
  if (has("busy") && has("quota"))
    return new AiError("Gemini is busy and the free quota on some models is used up. Wait a minute, then try again.", 503, "busy");
  if (has("busy")) return new AiError("Gemini is very busy right now. This is usually brief: wait a minute, then try again.", 503, "busy");
  if (has("timeout")) return new AiError("Gemini took too long to answer. Try again in a moment.", 504, "timeout");
  return new AiError("Gemini didn't send back a usable reply. Please try again.", 502, "empty");
}

/** The configured provider, or null when no key is set (the app then shows a sample plan). */
export function getProvider(): AiProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return createGemini({
    apiKey: key,
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    fallbacks: parseFallbackEnv(process.env.GEMINI_FALLBACK_MODELS),
  });
}
