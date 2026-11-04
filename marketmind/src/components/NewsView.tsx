"use client";
import { useMemo, useState } from "react";
import type { NewsDigest } from "@/lib/types";
import { useJson } from "@/lib/client/hooks";
import { Card, ErrorNote, Skeleton } from "./ui";
import { ArticleRow, GeoRiskGauge, SourceStatus, ThemeCard } from "./NewsBits";
import ResearchPanel from "./ResearchPanel";

export default function NewsView() {
  const { data, error, reload } = useJson<NewsDigest>("/api/news", 10 * 60 * 1000);
  const [theme, setTheme] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [geoOnly, setGeoOnly] = useState(false);
  const [sort, setSort] = useState<"impact" | "latest">("impact");

  const articles = useMemo(() => {
    if (!data) return [];
    const list = data.articles
      .filter((a) => theme === "all" || a.themes.some((t) => t.themeId === theme))
      .filter((a) => source === "all" || a.sourceId === source)
      .filter((a) => !geoOnly || a.themes.some((t) => t.geopolitical));
    return sort === "latest" ? list : [...list].sort((a, b) => b.severity - a.severity || b.published - a.published);
  }, [data, theme, source, geoOnly, sort]);

  if (error) return <ErrorNote text={`Couldn't load the news: ${error}`} onRetry={reload} />;
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton h={36} w={300} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={220} />)}</div>
      </div>
    );

  const geoThemes = data.themes.filter((t) => t.geopolitical);
  const macroThemes = data.themes.filter((t) => !t.geopolitical);
  const sourcesSeen = [...new Map(data.articles.map((a) => [a.sourceId, a.sourceName])).entries()];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">News & geopolitics</h1>
        <p className="text-sm soft">
          Headlines from five major market news services, sorted into geopolitical and macro themes, with each story mapped to the assets it is likely to push up or down.
        </p>
        <div className="mt-2">
          <SourceStatus sources={data.sources} sample={data.sample} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Geopolitical risk index">
          <GeoRiskGauge geo={data.geoRisk} />
          <p className="mt-3 text-xs leading-relaxed soft">
            Recency-weighted severity of conflict, sanctions, trade-war and political-risk stories. Escalation stories count fully; de-escalation (ceasefires, deals) counts a quarter.
          </p>
        </Card>
        <Card title="Regions in the news">
          <ul className="space-y-2">
            {data.geoRisk.regions.map((r) => (
              <li key={r.region} className="text-sm">
                <div className="flex justify-between">
                  <span>{r.region}</span>
                  <span className="num soft">{r.heat}</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full" style={{ background: "var(--neutral-mid)" }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${r.heat}%`, background: "var(--s1)" }} />
                </div>
              </li>
            ))}
            {data.geoRisk.regions.length === 0 && <li className="text-sm soft">No regional geopolitical stories right now.</li>}
          </ul>
        </Card>
        <Card title="Headline mood">
          <div className="num text-3xl font-bold">
            {data.sentiment > 0 ? "+" : ""}
            {data.sentiment.toFixed(2)}
          </div>
          <p className="text-sm soft">
            Average tone of recent headlines (−1 very negative, +1 very positive):{" "}
            <strong>{data.sentiment > 0.1 ? "risk-on" : data.sentiment < -0.1 ? "risk-off" : "mixed"}</strong>.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg p-2" style={{ background: "var(--up-soft)" }}>
              <div className="num font-bold">{data.articles.filter((a) => a.sentiment > 0.15).length}</div>
              <div className="text-xs soft">positive</div>
            </div>
            <div className="rounded-lg p-2" style={{ background: "var(--surface-2)" }}>
              <div className="num font-bold">{data.articles.filter((a) => Math.abs(a.sentiment) <= 0.15).length}</div>
              <div className="text-xs soft">neutral</div>
            </div>
            <div className="rounded-lg p-2" style={{ background: "var(--down-soft)" }}>
              <div className="num font-bold">{data.articles.filter((a) => a.sentiment < -0.15).length}</div>
              <div className="text-xs soft">negative</div>
            </div>
          </div>
        </Card>
      </div>

      {geoThemes.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Geopolitical themes</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {geoThemes.map((t) => (
              <ThemeCard key={t.themeId} t={t} />
            ))}
          </div>
        </section>
      )}
      {macroThemes.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Macro & market themes</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {macroThemes.map((t) => (
              <ThemeCard key={t.themeId} t={t} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={`All analysed headlines (${articles.length})`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select className="input w-auto py-1.5 text-sm" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Filter by theme">
              <option value="all">All themes</option>
              {data.themes.map((t) => (
                <option key={t.themeId} value={t.themeId}>
                  {t.label} ({t.articles})
                </option>
              ))}
            </select>
            <select className="input w-auto py-1.5 text-sm" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
              <option value="all">All sources</option>
              {sourcesSeen.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={geoOnly} onChange={(e) => setGeoOnly(e.target.checked)} /> Geopolitical only
            </label>
            <div className="seg ml-auto" role="group" aria-label="Sort">
              <button aria-pressed={sort === "impact"} onClick={() => setSort("impact")}>Most impactful</button>
              <button aria-pressed={sort === "latest"} onClick={() => setSort("latest")}>Latest</button>
            </div>
          </div>
          <ul>
            {articles.slice(0, 80).map((a) => (
              <ArticleRow key={a.id} a={a} />
            ))}
            {articles.length === 0 && <li className="py-6 text-center text-sm soft">No headlines match these filters.</li>}
          </ul>
        </Card>
        <div className="space-y-4">
          <ResearchPanel title="Ask about the news" />
          <Card title="How to read this">
            <ul className="space-y-2 text-sm soft">
              <li><strong>Themes</strong> are found by matching each headline against a library of geopolitical and macro patterns, each with a known way of reaching prices (for example oil supply → energy up, airlines down).</li>
              <li><strong>Direction</strong> flips when a story points the other way: a ceasefire, a trade deal, a hawkish Fed or a hot inflation print. Those tags carry a ↺.</li>
              <li><strong>Impact chips</strong> (▲/▼) show the assets each story most likely pushes, weighted by severity and recency.</li>
              <li>This is a speculative model. Use Deep Research for Claude&apos;s reading of the full articles.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
