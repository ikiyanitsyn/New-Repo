import { describe, expect, it } from "vitest";
import { autoSaveDecision, fingerprint, isExampleTrip, reconcile, type AutoSaveInput, type CloudLink } from "../cloud/sync";
import { friendlyError, summarize } from "../cloud/trips";
import { sampleTrip } from "../trip";

const link = (o: Partial<CloudLink> = {}): CloudLink => ({ tripId: "t1", revision: 3, role: "owner", syncedHash: "h", ...o });

describe("cloud sync rules", () => {
  it("fingerprints are stable and change with content", () => {
    const a = JSON.stringify(sampleTrip());
    expect(fingerprint(a)).toBe(fingerprint(a));
    expect(fingerprint(a)).not.toBe(fingerprint(a.replace("China", "Chine")));
  });

  it("adopts a newer copy when this device has no unsent edits", () => {
    expect(reconcile("h", link(), 5)).toBe("adopt-remote");
  });

  it("pushes offline edits rather than losing them", () => {
    expect(reconcile("changed", link(), 5)).toBe("push-local");
    expect(reconcile("changed", link(), 3)).toBe("push-local");
  });

  it("does nothing when both sides match", () => {
    expect(reconcile("h", link(), 3)).toBe("nothing");
  });
});

describe("account auto-save decision", () => {
  const real = { ...sampleTrip(), title: "My own trip" };
  const base: AutoSaveInput = {
    signedIn: true, enabled: true, linked: false, creating: false,
    isExample: false, stops: 3, hash: "h1", blockedHash: null,
  };

  it("creates a changed, unlinked trip when signed in", () => {
    expect(autoSaveDecision(base)).toBe("create");
  });

  it("waits when signed out, still on the opening page, or already linked", () => {
    expect(autoSaveDecision({ ...base, signedIn: false })).toBe("wait");
    expect(autoSaveDecision({ ...base, enabled: false })).toBe("wait");
    expect(autoSaveDecision({ ...base, linked: true })).toBe("wait");
  });

  it("never starts a second create while one is in flight", () => {
    expect(autoSaveDecision({ ...base, creating: true })).toBe("wait");
  });

  it("skips the untouched example and a trip with no cities", () => {
    expect(isExampleTrip(JSON.stringify(sampleTrip()))).toBe(true);
    expect(isExampleTrip(JSON.stringify(real))).toBe(false);
    expect(autoSaveDecision({ ...base, isExample: true })).toBe("wait");
    expect(autoSaveDecision({ ...base, stops: 0 })).toBe("wait");
  });

  it("waits on a blocked trip (just unlinked, or a failed auto-save) until it changes", () => {
    expect(autoSaveDecision({ ...base, blockedHash: "h1" })).toBe("wait");
    expect(autoSaveDecision({ ...base, blockedHash: "old", hash: "h2" })).toBe("create");
  });

  it("after a create is linked, the same trip is not created again", () => {
    expect(autoSaveDecision({ ...base, linked: true })).toBe("wait");
  });
});

describe("trip summaries", () => {
  const row = { id: "t1", owner_id: "me", title: "", data: sampleTrip(), revision: 2, updated_at: "2026-11-01T00:00:00Z" };

  it("summarises own and shared trips with roles", () => {
    const mine = summarize(row, "me", {});
    expect(mine.role).toBe("owner");
    expect(mine.title).toBe("China in spring");
    expect(mine.cities[0]).toBe("Beijing");
    expect(mine.nights).toBe(15);
    expect(summarize(row, "someone-else", { t1: "editor" }).role).toBe("editor");
    expect(summarize(row, "someone-else", {}).role).toBe("viewer");
  });

  it("copes with a broken trip in the database", () => {
    const s = summarize({ ...row, data: { nope: true } }, "me", {});
    expect(s.trip).toBeNull();
    expect(s.dates).toBeNull();
  });

  it("explains common errors in plain English", () => {
    expect(friendlyError(new Error("TypeError: Failed to fetch"))).toMatch(/offline/);
    expect(friendlyError({ message: 'relation "public.trips" does not exist' })).toMatch(/schema\.sql/);
    expect(friendlyError({ message: "new row violates row-level security policy" })).toMatch(/permission/);
  });
});

import { normalizeSupabaseUrl } from "../cloud/url";

describe("Supabase URL tidying", () => {
  it("keeps a correct Project URL", () => {
    expect(normalizeSupabaseUrl("https://abcdefgh.supabase.co").url).toBe("https://abcdefgh.supabase.co");
  });
  it("drops extra parts and quotes", () => {
    expect(normalizeSupabaseUrl(' "https://abcdefgh.supabase.co/rest/v1/" ').url).toBe("https://abcdefgh.supabase.co");
    expect(normalizeSupabaseUrl("abcdefgh.supabase.co/").url).toBe("https://abcdefgh.supabase.co");
  });
  it("recognises the dashboard address", () => {
    expect(normalizeSupabaseUrl("https://supabase.com/dashboard/project/abcdefgh/settings/api")).toEqual({ url: "https://abcdefgh.supabase.co", problem: "dashboard" });
  });
  it("reports a missing value", () => {
    expect(normalizeSupabaseUrl(undefined).problem).toBe("missing");
  });
});
