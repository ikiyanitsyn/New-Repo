import { aiEnabled, MODEL } from "@/lib/ai/claude";
import { NEWS_SOURCES } from "@/lib/news/sources";

export async function GET() {
  return Response.json({
    ai: aiEnabled(),
    model: aiEnabled() ? MODEL : null,
    offlineForced: process.env.MARKETMIND_OFFLINE === "1" || process.env.MARKETMIND_OFFLINE === "true",
    sources: NEWS_SOURCES.map((s) => ({ id: s.id, name: s.name, homepage: s.homepage })),
  });
}
