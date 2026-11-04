"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useJson<T>(url: string | null, refreshMs = 0) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loadedUrl: string | null }>({ data: null, error: null, loadedUrl: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Request failed (${r.status})`);
        return r.json() as Promise<T>;
      })
      .then((d) => alive && setState({ data: d, error: null, loadedUrl: url }))
      .catch((e: Error) => alive && setState((s) => ({ ...s, error: e.message, loadedUrl: url })));
    return () => {
      alive = false;
    };
  }, [url, tick]);

  useEffect(() => {
    if (!refreshMs) return;
    const id = setInterval(() => setTick((t) => t + 1), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const stale = state.loadedUrl !== url;
  return { data: stale ? null : state.data, error: stale ? null : state.error, loading: stale, reload };
}

/** POST to an NDJSON endpoint and hand each event to `onEvent` as it arrives. */
export function useNdjson<E>() {
  const ctl = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);

  const start = useCallback(async (url: string, body: unknown, onEvent: (e: E) => void) => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setRunning(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: c.signal });
      if (!res.ok || !res.body) {
        const msg = (await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`;
        onEvent({ type: "error", text: msg } as E);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) onEvent(JSON.parse(line) as E);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") onEvent({ type: "error", text: (e as Error).message } as E);
    } finally {
      if (ctl.current === c) setRunning(false);
    }
  }, []);

  const stop = useCallback(() => {
    ctl.current?.abort();
    setRunning(false);
  }, []);

  useEffect(() => () => ctl.current?.abort(), []);
  return { start, stop, running };
}
