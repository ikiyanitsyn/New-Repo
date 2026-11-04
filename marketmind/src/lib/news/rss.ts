import { XMLParser } from "fast-xml-parser";
import type { Article } from "../types";
import { hashString } from "../market/sample";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", processEntities: true });

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function cleanText(raw: unknown): string {
  let s = typeof raw === "string" ? raw : raw && typeof raw === "object" && "#text" in raw ? String((raw as { "#text": unknown })["#text"]) : raw == null ? "" : String(raw);
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ");
  s = s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
  return s.replace(/\s+/g, " ").trim();
}

function asArray<T>(x: T | T[] | undefined): T[] {
  return x == null ? [] : Array.isArray(x) ? x : [x];
}

function linkOf(item: Record<string, unknown>): string | null {
  const l = item.link;
  if (typeof l === "string") return l.trim();
  for (const entry of asArray(l as Record<string, string> | Record<string, string>[])) {
    if (entry && typeof entry === "object" && entry["@href"]) return entry["@href"];
  }
  const guid = item.guid;
  const g = typeof guid === "string" ? guid : (guid as Record<string, string> | undefined)?.["#text"];
  return g && g.startsWith("http") ? g : null;
}

/** Parse an RSS 2.0 or Atom document into articles for one source. */
export function parseFeed(xml: string, sourceId: string, sourceName: string): Article[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }
  const rss = doc.rss as { channel?: { item?: unknown } } | undefined;
  const feed = doc.feed as { entry?: unknown } | undefined;
  const items = asArray((rss?.channel?.item ?? feed?.entry) as Record<string, unknown> | Record<string, unknown>[]);
  const out: Article[] = [];
  for (const item of items) {
    let title = cleanText(item.title);
    if (!title) continue;
    // Google News appends " - Publisher" to every title.
    title = title.replace(/\s+-\s+(Reuters|Bloomberg|WSJ|The Wall Street Journal|CNBC|Yahoo Finance)$/i, "");
    const summary = cleanText(item.description ?? item.summary ?? item.content ?? "").slice(0, 500);
    const dateRaw = (item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]) as string | undefined;
    const published = dateRaw ? Date.parse(cleanText(dateRaw)) : NaN;
    const url = linkOf(item);
    out.push({
      id: `${sourceId}-${hashString(url ?? title).toString(36)}`,
      sourceId,
      sourceName,
      title,
      summary: summary === title ? "" : summary,
      url,
      published: Number.isFinite(published) ? published : Date.now(),
      sample: false,
    });
  }
  return out;
}
