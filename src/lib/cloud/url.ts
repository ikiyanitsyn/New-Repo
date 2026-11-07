/**
 * Supabase's Project URL looks like https://abcdefgh.supabase.co. People often
 * copy it with extra parts (".../rest/v1/", a trailing slash) or copy the
 * dashboard address instead. Tidy the first kind; flag the second.
 */
export function normalizeSupabaseUrl(raw: string | undefined): { url: string | null; problem: string | null } {
  if (!raw) return { url: null, problem: "missing" };
  let s = raw.trim().replace(/^["']|["']$/g, "");
  const dash = /supabase\.com\/dashboard\/project\/([a-z0-9]+)/i.exec(s);
  if (dash) return { url: `https://${dash[1]}.supabase.co`, problem: "dashboard" };
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return { url: `${u.protocol}//${u.host}`, problem: null };
  } catch {
    return { url: null, problem: "invalid" };
  }
}
