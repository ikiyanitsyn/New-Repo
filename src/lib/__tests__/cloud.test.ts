import { describe, expect, it } from "vitest";
import { fingerprint, reconcile, type CloudLink } from "../cloud/sync";
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
