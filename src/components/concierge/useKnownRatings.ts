"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanResponse } from "@/lib/ai/schema";

export interface KnownRating {
  rating: number;
  count?: number;
}

export const ratingKey = (city: string, placeName: string) => `${city}|${placeName}`;

/**
 * Ratings the server already knows for the named places in a plan. This only reads the server's
 * memory (it never makes a ratings lookup), so it is free to call whenever the plan changes.
 * Places with no known rating are simply absent.
 */
export function useKnownRatings(resp: PlanResponse | undefined): Record<string, KnownRating> {
  const [known, setKnown] = useState<Record<string, KnownRating>>({});

  const wanted = useMemo(() => {
    const keys = new Set<string>();
    for (const d of resp?.days ?? []) for (const it of d.items) if (it.placeName) keys.add(ratingKey(d.city, it.placeName));
    return [...keys].sort();
  }, [resp]);
  const signature = wanted.join("\n");

  useEffect(() => {
    if (!signature) return;
    const places = signature.split("\n").map((k) => {
      const i = k.indexOf("|");
      return { city: k.slice(0, i), name: k.slice(i + 1) };
    });
    const controller = new AbortController();
    fetch("/api/plan/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ places }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ratings?: Record<string, KnownRating> } | null) => {
        if (j?.ratings) setKnown((prev) => ({ ...prev, ...j.ratings }));
      })
      .catch(() => {
        // No ratings is fine.
      });
    return () => controller.abort();
  }, [signature]);

  return known;
}
