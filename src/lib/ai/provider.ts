import "server-only";

/**
 * One small interface for any AI model, so Gemini can be swapped for another
 * provider (e.g. Claude) by adding a file here and changing AI_PROVIDER.
 */
export interface AiProvider {
  name: "gemini";
  /** Returns the model's raw text, which should be a JSON document. */
  generateJson(system: string, user: string): Promise<string>;
}

export class AiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function gemini(apiKey: string, model: string): AiProvider {
  return {
    name: "gemini",
    async generateJson(system, user) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 16384 },
          }),
          signal: AbortSignal.timeout(90_000),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        error?: { message?: string; status?: string };
      };
      if (!res.ok) {
        const msg = json.error?.message ?? `Gemini responded ${res.status}`;
        if (res.status === 429) throw new AiError("The free Gemini quota is used up for now. Wait a minute (or until tomorrow) and try again.", 429);
        if (res.status === 404) throw new AiError(`Gemini model "${model}" wasn't found. Set GEMINI_MODEL to a current Flash model (see docs/SETUP_GUIDE.md).`, 404);
        throw new AiError(msg, res.status);
      }
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new AiError(`Gemini returned no text (${json.candidates?.[0]?.finishReason ?? "unknown reason"}).`);
      return text;
    },
  };
}

/** The configured provider, or null when no key is set (the app then shows a sample plan). */
export function getProvider(): AiProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return gemini(key, process.env.GEMINI_MODEL || "gemini-3.5-flash");
}
