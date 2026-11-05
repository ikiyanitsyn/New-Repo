/**
 * Choosing backup Gemini models.
 *
 * The configured model (GEMINI_MODEL) always goes first. Backups come from GEMINI_FALLBACK_MODELS
 * when it is set, otherwise from Gemini's ListModels endpoint: text "flash" models that support
 * generateContent, plain Flash before Flash-Lite, newest version first.
 */

export interface ListedModel {
  name: string;
  supportedGenerationMethods?: string[];
}

/** Variants that can't write a text itinerary (or aren't meant to). */
const NOT_TEXT = /(image|tts|live|embed|audio|computer-use|robotics|aqa|vision|veo|imagen)/i;
/** Preview and experimental builds: used only when nothing stable is listed. */
const PREVIEW = /(preview|experimental|-exp\b|-exp-)/i;

/** How many models to try in total for one call (primary included). */
export const MAX_CHAIN = 5;

/** Used when ListModels can't be reached. Missing ones are skipped quickly (404). */
export const DEFAULT_BACKUPS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];

export const bareName = (name: string) => name.trim().replace(/^models\//, "");

function version(name: string): number {
  const m = /gemini-(\d+(?:\.\d+)?)/.exec(name);
  return m ? parseFloat(m[1]) : -1; // "-latest" aliases have no number: after the versioned ones
}

const tier = (name: string) => (name.includes("flash-lite") ? 1 : 0);

/** Pick and order backup candidates from a ListModels reply. */
export function pickFlashModels(models: ListedModel[]): string[] {
  const usable = models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => bareName(m.name))
    .filter((n) => n.includes("flash") && !NOT_TEXT.test(n));
  const unique = [...new Set(usable)];
  // "gemini-2.0-flash-001" is the same model as "gemini-2.0-flash": keep just one.
  const deduped = unique.filter((n) => {
    const base = n.replace(/-\d{3}$/, "");
    return base === n || !unique.includes(base);
  });
  const stable = deduped.filter((n) => !PREVIEW.test(n));
  const pool = stable.length ? stable : deduped;
  return pool.sort((a, b) => tier(a) - tier(b) || version(b) - version(a) || a.length - b.length || a.localeCompare(b));
}

/** The primary model followed by up to MAX_CHAIN - 1 distinct backups. */
export function buildChain(primary: string, backups: string[]): string[] {
  const first = bareName(primary);
  const rest = backups.map(bareName).filter((n) => n && n !== first);
  return [first, ...new Set(rest)].slice(0, MAX_CHAIN);
}

/** Parse GEMINI_FALLBACK_MODELS. Undefined means "discover"; "none" means no backups. */
export function parseFallbackEnv(value: string | undefined): string[] | undefined {
  if (!value || !value.trim()) return undefined;
  if (value.trim().toLowerCase() === "none") return [];
  return value.split(",").map(bareName).filter(Boolean);
}

const TTL_MS = 6 * 60 * 60 * 1000;
const FAILED_TTL_MS = 10 * 60 * 1000;
let cache: { key: string; at: number; ttl: number; models: string[] } | null = null;

/** For tests. */
export function resetModelCache() {
  cache = null;
}

/** Ask Gemini which models this key can use. Cached in memory for about 6 hours. */
export async function discoverBackups(apiKey: string, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<string[]> {
  const key = apiKey.slice(-8);
  if (cache && cache.key === key && now - cache.at < cache.ttl) return cache.models;
  try {
    const listed: ListedModel[] = [];
    let pageToken = "";
    for (let page = 0; page < 5; page++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const res = await fetchImpl(url, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(5_000) });
      if (!res.ok) throw new Error(`ListModels responded ${res.status}`);
      const json = (await res.json()) as { models?: ListedModel[]; nextPageToken?: string };
      listed.push(...(json.models ?? []));
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }
    const models = pickFlashModels(listed);
    cache = { key, at: now, ttl: models.length ? TTL_MS : FAILED_TTL_MS, models: models.length ? models : DEFAULT_BACKUPS };
  } catch {
    cache = { key, at: now, ttl: FAILED_TTL_MS, models: DEFAULT_BACKUPS };
  }
  return cache.models;
}
