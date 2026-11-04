"use client";
import { useState } from "react";
import { useNdjson } from "@/lib/client/hooks";
import Markdown from "./Markdown";

type Ev = { type: "status" | "text" | "source" | "meta" | "error" | "done"; text?: string; title?: string; url?: string; mode?: "ai" | "offline" };

const SUGGESTIONS_SYMBOL = ["How could the latest geopolitical news move this?", "What's the risk into the next earnings report?", "Is this a buy-the-dip setup or a falling knife?"];
const SUGGESTIONS_MARKET = ["Which sectors benefit if oil spikes?", "What does the Fed path mean for tech vs. small caps?", "Where is geopolitical risk underpriced?"];

export default function ResearchPanel({ symbol, title = "Deep research" }: { symbol?: string; title?: string }) {
  const { start, stop, running } = useNdjson<Ev>();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sources, setSources] = useState<{ title: string; url: string }[]>([]);
  const [mode, setMode] = useState<"ai" | "offline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState("");

  function run(q?: string) {
    setText("");
    setSources([]);
    setError(null);
    setMode(null);
    setStatus("Starting…");
    start("/api/research", { symbol, focus: (q ?? focus) || undefined }, (e) => {
      if (e.type === "text") {
        setStatus(null);
        setText((t) => t + (e.text ?? ""));
      } else if (e.type === "status") setStatus(e.text ?? null);
      else if (e.type === "source" && e.url) setSources((s) => (s.some((x) => x.url === e.url) ? s : [...s, { title: e.title ?? e.url!, url: e.url! }]));
      else if (e.type === "meta") setMode(e.mode ?? null);
      else if (e.type === "error") setError(e.text ?? "Something went wrong");
      else if (e.type === "done") setStatus(null);
    });
  }

  const suggestions = symbol ? SUGGESTIONS_SYMBOL : SUGGESTIONS_MARKET;
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="card-h">{title}</h2>
        {mode && <span className={`chip ${mode === "ai" ? "chip-accent" : ""}`}>{mode === "ai" ? "✦ Claude + live web research" : "◇ Built-in engine"}</span>}
      </div>
      <p className="mb-3 text-sm soft">
        Reads the latest reporting from Bloomberg, Reuters, The Wall Street Journal, CNBC and Yahoo Finance, then maps each development to likely price impact.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder={symbol ? "Optional: ask a specific question…" : "Optional: focus the brief…"}
          onKeyDown={(e) => e.key === "Enter" && !running && run()}
        />
        {running ? (
          <button className="btn" onClick={stop}>Stop</button>
        ) : (
          <button className="btn btn-primary whitespace-nowrap" onClick={() => run()}>
            {text ? "Run again" : symbol ? "Research this" : "Generate market brief"}
          </button>
        )}
      </div>
      {!text && !running && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} className="chip hover:opacity-80" onClick={() => { setFocus(s); run(s); }}>
              {s}
            </button>
          ))}
        </div>
      )}
      {status && (
        <p className="mt-3 text-sm soft">
          <span className="pulse mr-1" aria-hidden>●</span>
          {status}
        </p>
      )}
      {error && <p className="mt-3 text-sm down">⚠ {error}</p>}
      {text && (
        <div className="mt-2" aria-live="polite">
          <Markdown text={text} />
        </div>
      )}
      {sources.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold soft">Sources searched ({sources.length})</summary>
          <ul className="mt-2 space-y-1">
            {sources.map((s) => (
              <li key={s.url} className="truncate">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "var(--accent)" }}>
                  {s.title}
                </a>{" "}
                <span className="muted">{new URL(s.url).hostname.replace(/^www\./, "")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
