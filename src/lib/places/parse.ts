import type { Place, PlaceCategory } from "./types";

/**
 * Parser for Wikivoyage listing templates in raw wikitext, e.g.
 *   * {{see | name=Wenshu Monastery | lat=30.677 | long=104.073 | content=A Buddhist temple… }}
 *   * {{listing | type=sleep | name=… }}
 * Handles nested templates and links inside values, and tracks section
 * headings so stays can be grouped as Budget / Mid-range / Splurge.
 */

const LISTING_TYPES = new Set(["see", "do", "buy", "eat", "drink", "sleep", "listing"]);
const TIERS = { budget: "Budget", "mid-range": "Mid-range", midrange: "Mid-range", splurge: "Splurge" } as const;

interface Heading { index: number; level: number; text: string }

function headings(text: string): Heading[] {
  const out: Heading[] = [];
  const re = /^(={2,4})\s*(.+?)\s*\1\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ index: m.index, level: m[1].length, text: cleanText(m[2]) });
  return out;
}

/** Find the end of a template starting at `start` ("{{"), honouring nesting. Returns index after "}}". */
function templateEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") { depth++; i++; }
    else if (text[i] === "}" && text[i + 1] === "}") { depth--; i++; if (depth === 0) return i + 1; }
  }
  return -1;
}

/** Split template body on "|" at depth 0 (outside nested {{ }} and [[ ]]). */
function splitParams(body: string): string[] {
  const parts: string[] = [];
  let depthT = 0, depthL = 0, cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{") { depthT++; cur += two; i++; continue; }
    if (two === "}}") { depthT--; cur += two; i++; continue; }
    if (two === "[[") { depthL++; cur += two; i++; continue; }
    if (two === "]]") { depthL--; cur += two; i++; continue; }
    if (body[i] === "|" && depthT === 0 && depthL === 0) { parts.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  parts.push(cur);
  return parts;
}

/** Replace nested templates with readable text. */
function flattenTemplates(s: string): string {
  let out = s;
  for (let guard = 0; guard < 20; guard++) {
    const start = out.lastIndexOf("{{");
    if (start < 0) break;
    const end = templateEnd(out, start);
    if (end < 0) { out = out.slice(0, start); break; }
    const parts = splitParams(out.slice(start + 2, end - 2));
    const name = parts[0].trim().toLowerCase();
    const positional = parts.slice(1).filter((p) => !/^\s*[\w-]+\s*=/.test(p)).map((p) => p.trim());
    let rep = "";
    if (name === "lang" || name === "zh" || name === "ja" || name === "ko") rep = positional[positional.length - 1] ?? "";
    else if (positional.length === 1) rep = positional[0];
    out = out.slice(0, start) + rep + out.slice(end);
  }
  return out;
}

export function cleanText(s: string): string {
  return flattenTemplates(
    s
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<ref[^>]*\/>/g, "")
      .replace(/<ref[\s\S]*?<\/ref>/g, ""),
  )
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1") // [[Target|Label]] → Label
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1") // [http://x Label] → Label
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\]/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function num(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number(v.trim());
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

function tierFrom(text: string): Place["tier"] {
  return TIERS[text.toLowerCase().replace(/\s+/g, "") as keyof typeof TIERS];
}

const SECTION_CATEGORY: Record<string, PlaceCategory> = { see: "see", do: "do", buy: "buy", eat: "eat", drink: "drink", sleep: "sleep" };

export function parseListings(wikitext: string, opts: { district?: string; idPrefix?: string } = {}): Place[] {
  const hs = headings(wikitext);
  const out: Place[] = [];
  const re = /\{\{\s*(see|do|buy|eat|drink|sleep|listing)\s*(?=\||\}\})/gi;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(wikitext))) {
    const start = m.index;
    const end = templateEnd(wikitext, start);
    if (end < 0) break;
    re.lastIndex = end;

    const parts = splitParams(wikitext.slice(start + 2, end - 2));
    const type = parts[0].trim().toLowerCase();
    if (!LISTING_TYPES.has(type)) continue;
    const params: Record<string, string> = {};
    for (const p of parts.slice(1)) {
      const eq = p.indexOf("=");
      if (eq < 0) continue;
      params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
    }

    // Headings before this listing: the level-2 section and the closest sub-heading.
    const before = hs.filter((h) => h.index < start);
    const section = [...before].reverse().find((h) => h.level === 2);
    const sub = [...before].reverse().find((h) => h.level > 2 && (!section || h.index > section.index));

    let category: PlaceCategory | undefined =
      type === "listing" ? SECTION_CATEGORY[(params.type || "").toLowerCase()] : (type as PlaceCategory);
    if (!category && section) category = SECTION_CATEGORY[section.text.toLowerCase()];
    if (!category) continue;

    const name = cleanText(params.name ?? "");
    if (!name) continue;

    const tier = sub ? tierFrom(sub.text) : undefined;
    const lat = num(params.lat);
    const lon = num(params.long ?? params.lon);
    const text = (k: string) => {
      const v = params[k] ? cleanText(params[k]) : "";
      return v || undefined;
    };
    const url = params.url?.trim();

    out.push({
      id: `${opts.idPrefix ?? "p"}-${n++}`,
      category,
      name,
      alt: text("alt"),
      lat: lat !== undefined && lon !== undefined ? lat : undefined,
      lon: lat !== undefined && lon !== undefined ? lon : undefined,
      description: text("content") ?? text("description"),
      address: text("address"),
      directions: text("directions"),
      hours: text("hours"),
      price: text("price"),
      checkin: text("checkin"),
      checkout: text("checkout"),
      phone: text("phone"),
      url: url && /^https?:\/\//.test(url) ? url : undefined,
      image: params.image?.trim() || undefined,
      wikipedia: params.wikipedia?.trim() || undefined,
      tier,
      group: !tier && sub ? sub.text : undefined,
      district: opts.district,
    });
  }
  return out;
}

/** District sub-articles linked from a big-city article, e.g. [[Beijing/Dongcheng|Dongcheng]]. */
export function districtLinks(wikitext: string, title: string, limit = 8): string[] {
  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[\\[\\s*(${esc}\\/[^\\]|#]+)`, "g");
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext))) {
    const t = m[1].trim().replace(/_/g, " ");
    if (!found.includes(t)) found.push(t);
    if (found.length >= limit) break;
  }
  return found;
}

export function redirectTarget(wikitext: string): string | undefined {
  const m = /^#REDIRECT\s*\[\[([^\]|#]+)/i.exec(wikitext.trim());
  return m?.[1].trim();
}
