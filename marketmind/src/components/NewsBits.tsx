"use client";
import Link from "next/link";
import type { AnalyzedArticle, GeoRisk, ThemeSummary } from "@/lib/types";
import { displaySymbol, symbolHref, timeAgo } from "@/lib/client/format";

const GEO_COLOR: Record<GeoRisk["label"], string> = {
  Calm: "var(--up-fill)",
  Guarded: "var(--s1)",
  Elevated: "#fab219",
  High: "#ec835a",
  Severe: "var(--down-fill)",
};

export function GeoRiskGauge({ geo }: { geo: GeoRisk }) {
  const r = 64;
  const c = Math.PI * r;
  const frac = geo.index / 100;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative shrink-0" style={{ width: 160, height: 96 }}>
        <svg width={160} height={96} viewBox="0 0 160 96" role="img" aria-label={`Geopolitical risk ${geo.index} of 100, ${geo.label}`}>
          <path d="M16 84 A64 64 0 0 1 144 84" fill="none" stroke="var(--neutral-mid)" strokeWidth={12} strokeLinecap="round" />
          <path d="M16 84 A64 64 0 0 1 144 84" fill="none" stroke={GEO_COLOR[geo.label]} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="num text-3xl font-bold leading-none">{geo.index}</div>
          <div className="text-xs font-semibold soft">{geo.label}</div>
        </div>
      </div>
      <div className="w-full min-w-0 flex-1 space-y-1.5">
        {geo.drivers.length === 0 && <p className="text-sm soft">No geopolitical stories in the current news flow.</p>}
        {geo.drivers.map((d) => (
          <div key={d.label} className="text-xs">
            <div className="flex justify-between">
              <span className="truncate">{d.label}</span>
              <span className="num soft">{d.heat}</span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full" style={{ background: "var(--neutral-mid)" }}>
              <div className="h-1.5 rounded-full" style={{ width: `${d.heat}%`, background: "var(--s2)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImpactChips({ impacts, max = 4 }: { impacts: { symbol: string; score: number; why?: string }[]; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {impacts.slice(0, max).map((i) => (
        <Link key={i.symbol} href={symbolHref(i.symbol)} title={i.why} className={`chip num ${i.score > 0 ? "chip-up" : "chip-down"} hover:opacity-80`}>
          {i.score > 0 ? "▲" : "▼"} {displaySymbol(i.symbol)}
        </Link>
      ))}
    </div>
  );
}

function SentimentDot({ s }: { s: number }) {
  const label = s > 0.15 ? "Positive tone" : s < -0.15 ? "Negative tone" : "Neutral tone";
  const color = s > 0.15 ? "var(--up-fill)" : s < -0.15 ? "var(--down-fill)" : "var(--ink-3)";
  return (
    <span title={label} className="inline-flex items-center gap-1 text-xs soft">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function ArticleRow({ a, compact = false }: { a: AnalyzedArticle; compact?: boolean }) {
  return (
    <li className="py-3" style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-semibold">{a.sourceName}</span>
        <span className="muted">{timeAgo(a.published)}</span>
        {a.severity >= 0.75 && <span className="chip chip-warn">High impact</span>}
        {a.themes.slice(0, compact ? 2 : 4).map((t) => (
          <span key={t.themeId} className={`chip ${t.geopolitical ? "chip-accent" : ""}`} title={t.polarity < 0 ? "Story points to easing / the opposite direction" : undefined}>
            {t.geopolitical && <span aria-hidden>◎</span>}
            {t.label}
            {t.polarity < 0 && <span aria-hidden>↺</span>}
          </span>
        ))}
      </div>
      {a.url ? (
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium leading-snug hover:underline">
          {a.title}
        </a>
      ) : (
        <span className="font-medium leading-snug">{a.title}</span>
      )}
      {!compact && a.summary && <p className="mt-1 line-clamp-2 text-sm soft">{a.summary}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <SentimentDot s={a.sentiment} />
        {a.impacts.length > 0 && <span className="text-xs muted">Likely to move:</span>}
        <ImpactChips impacts={a.impacts} max={compact ? 4 : 6} />
      </div>
    </li>
  );
}

export function ThemeCard({ t }: { t: ThemeSummary }) {
  return (
    <article className="card flex flex-col p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">
          {t.geopolitical && <span aria-hidden className="mr-1" style={{ color: "var(--accent)" }}>◎</span>}
          {t.label}
        </h3>
        <span className="chip num" title="Heat: how much recent, severe coverage this theme is getting (0–100)">
          🔥 {t.heat}
        </span>
      </div>
      <p className="mb-2 text-xs soft">
        {t.articles} {t.articles === 1 ? "story" : "stories"} ·{" "}
        {t.netPolarity > 0.25 ? (t.geopolitical ? "escalating" : "pointing up") : t.netPolarity < -0.25 ? (t.geopolitical ? "easing" : "pointing down") : "mixed signals"}
      </p>
      <p className="mb-3 text-sm leading-relaxed soft">{t.explainer}</p>
      {t.topImpacts.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-semibold muted">Current price pressure</div>
          <ImpactChips impacts={t.topImpacts} max={6} />
        </div>
      )}
      <ul className="mt-auto space-y-1 text-sm">
        {t.headlines.slice(0, 3).map((h) => (
          <li key={h.title} className="leading-snug">
            <span className="muted text-xs">{h.source} · </span>
            {h.url ? (
              <a href={h.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {h.title}
              </a>
            ) : (
              h.title
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function SourceStatus({ sources, sample }: { sources: { id: string; name: string; status: string; count: number }[]; sample: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sources.map((s) => (
        <span key={s.id} className={`chip ${s.status === "live" ? "chip-up" : ""}`} title={s.status === "live" ? `${s.count} stories fetched` : "Feed unreachable right now"}>
          <span aria-hidden>{s.status === "live" ? "●" : "○"}</span>
          {s.name}
          {s.status === "live" && <span className="num opacity-75">{s.count}</span>}
        </span>
      ))}
      {sample && <span className="chip chip-warn whitespace-normal">Showing illustrative sample headlines: live feeds unreachable</span>}
    </div>
  );
}
