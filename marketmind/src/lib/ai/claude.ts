import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SOURCE_DOMAINS } from "../news/sources";

export const MODEL = process.env.MARKETMIND_MODEL || "claude-opus-5-5";

/** True when Claude credentials are configured (an API key, an auth token, or MARKETMIND_AI=1 for an `ant auth login` profile). */
export function aiEnabled(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.MARKETMIND_AI === "1");
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export interface Source {
  title: string;
  url: string;
}

export interface StreamOptions {
  system: string;
  prompt: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  webSearch?: boolean;
  maxTokens?: number;
  onText: (text: string) => void;
  onSource?: (s: Source) => void;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}

/**
 * Stream one Claude response as text. With webSearch on, Claude may search, but only the five
 * market news services. Server-side fallbacks are on, so a request a model declines is re-run on
 * Anthropic's recommended fallback model instead of failing.
 */
export async function streamClaude(opts: StreamOptions): Promise<{ text: string; stopReason: string | null }> {
  const anthropic = getClient();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const tools: Anthropic.Beta.BetaToolUnion[] = opts.webSearch
    ? [{ type: "web_search_20260209", name: "web_search", max_uses: 8, allowed_domains: SOURCE_DOMAINS }]
    : [];
  let full = "";
  const seen = new Set<string>();

  for (let turn = 0; turn < 4; turn++) {
    const stream = anthropic.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: opts.maxTokens ?? 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: opts.effort ?? "medium" },
        system: opts.system,
        messages,
        ...(tools.length ? { tools } : {}),
      },
      { signal: opts.signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const b = event.content_block;
        if (b.type === "server_tool_use") opts.onStatus?.("Searching the market news services…");
        if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
          for (const r of b.content) {
            if (r.type === "web_search_result" && !seen.has(r.url)) {
              seen.add(r.url);
              opts.onSource?.({ title: r.title, url: r.url });
            }
          }
        }
      } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        full += event.delta.text;
        opts.onText(event.delta.text);
      }
    }

    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") {
      const note = "\n\n_The model declined to continue this request._";
      full += note;
      opts.onText(note);
      return { text: full, stopReason: msg.stop_reason };
    }
    if (msg.stop_reason !== "pause_turn") return { text: full, stopReason: msg.stop_reason };
    // A long server-tool turn paused: send it back so the server continues it.
    messages.push({ role: "assistant", content: msg.content });
  }
  return { text: full, stopReason: "pause_turn" };
}

// ---- Structured debate verdict ----

export const VerdictSchema = z.object({
  consensus: z.enum(["Strongly For", "Lean For", "Split", "Lean Against", "Strongly Against"]),
  votes: z.array(z.object({ advisorId: z.string(), stance: z.number().int(), oneLiner: z.string() })),
  keyRisks: z.array(z.string()),
  keyCatalysts: z.array(z.string()),
  saferAlternative: z.string(),
  summary: z.string(),
});

export type AiVerdict = z.infer<typeof VerdictSchema>;

export async function moderatorVerdict(system: string, prompt: string): Promise<AiVerdict | null> {
  const res = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: zodOutputFormat(VerdictSchema) },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  if (res.stop_reason === "refusal") return null;
  return res.parsed_output ?? null;
}
