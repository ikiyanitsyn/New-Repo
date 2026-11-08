"use client";

import { useEffect, useState } from "react";

export interface BannerInfo { url: string | null; hero: string | null; credit: string; creditUrl: string }

const memo = new Map<string, BannerInfo>();

/** A city's hero photo from the travel guide, remembered for this visit. */
export function useCityBanner(code: string | undefined | null, width = 1920): BannerInfo | null {
  const key = code ? `${code}|${width}` : "";
  const [state, setState] = useState<{ key: string; info: BannerInfo | null }>({ key: "", info: null });
  useEffect(() => {
    if (!code || memo.has(key)) return;
    let alive = true;
    fetch(`/api/places/banner?city=${code}&w=${width}`)
      .then((r) => r.json())
      .then((j) => {
        const info: BannerInfo = { url: j.url ?? null, hero: j.hero ?? null, credit: j.credit ?? "", creditUrl: j.creditUrl ?? "" };
        memo.set(key, info);
        if (alive) setState({ key, info });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [code, key, width]);
  if (!code) return null;
  return memo.get(key) ?? (state.key === key ? state.info : null);
}
