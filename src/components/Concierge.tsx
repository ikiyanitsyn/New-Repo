"use client";

import { useMemo, useRef, useState } from "react";
import { findCity } from "@/lib/cities";
import { fmtDay, fmtShort } from "@/lib/format";
import type { PlanDay, PlanItem, PlanResponse, SavedPlan } from "@/lib/ai/schema";
import { stopsWithDates, tripLegs, type Trip } from "@/lib/trip";
import type { TripAction } from "@/lib/tripReducer";
import {
  ArrowIcon, BedIcon, ColumnsIcon, CompassIcon, ExternalIcon, ForkIcon, GlassIcon, SparkIcon, TrainIcon,
} from "./icons";
import { PlaneLoader } from "./PlaneLoader";

interface Props {
  trip: Trip;
  dispatch: React.Dispatch<TripAction>;
  onClose: () => void;
  onOpenCity: (cityCode: string) => void;
  /** Open a place from the plan in the city guide. */
  onOpenPlace?: (cityCode: string, placeName: string) => void;
}

interface Official { country: string; links: { label: string; url: string }[] }

const INTERESTS = ["Food & markets", "History & temples", "Art & design", "Nature & gardens", "Nightlife", "Shopping", "Wellness"];
const PACE = ["Relaxed", "Balanced", "Full days"];
const COMFORT = ["Good value", "Comfortable", "Luxury"];

const KIND_ICON: Record<PlanItem["kind"], (p: { size?: number; className?: string }) => React.ReactElement> = {
  see: ColumnsIcon, do: CompassIcon, eat: ForkIcon, drink: GlassIcon, stay: BedIcon, travel: TrainIcon, free: SparkIcon,
};

/** The browser gives up after this long; the server stops itself at about 75 seconds. */
const CLIENT_TIMEOUT_MS = 90_000;

/** Honest, generic stages shown until the server reports what it's doing. */
function stageFor(seconds: number): string {
  if (seconds < 4) return "Reading your route and saved places…";
  if (seconds < 12) return "Asking Gemini to write your days…";
  if (seconds < 45) return "Writing your itinerary…";
  return "Still writing. Gemini is slower than usual…";
}

class PlanFailure extends Error {}

interface PlanReply {
  source: SavedPlan["source"];
  response: PlanResponse;
  official?: Official[];
  notice?: string;
  models?: string[];
  usedBackup?: boolean;
}

/** Read the planner's reply: a stream of progress lines then the result, or plain JSON. */
async function readPlan(res: Response, onProgress: (message: string) => void): Promise<PlanReply> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("ndjson") || !res.body) {
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlanFailure(j.error || "The planner couldn't finish. Please try again.");
    return j as PlanReply;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg: { type?: string; message?: string; error?: string } & Partial<PlanReply>;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.type === "progress" && msg.message) onProgress(msg.message);
      else if (msg.type === "error") throw new PlanFailure(msg.error || "The planner couldn't finish. Please try again.");
      else if (msg.type === "result") return msg as PlanReply;
    }
    if (done) break;
  }
  throw new PlanFailure("The planner stopped before finishing. Please try again.");
}

const stopSignature = (t: Trip) => t.stops.map((s) => `${s.city}:${s.nights}`).join(",") + `|${t.departDate}`;

export function Concierge({ trip, dispatch, onClose, onOpenCity, onOpenPlace }: Props) {
  const plan = trip.plan;
  const [request, setRequest] = useState(plan?.request ?? "");
  const [prefs, setPrefs] = useState<string[]>(plan?.preferences ?? []);
  const [answers, setAnswers] = useState<Record<string, string[]>>(plan?.answers ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [view, setView] = useState<"days" | "before">("days");

  const outdated = plan && plan.forStops !== stopSignature(trip);
  const legs = useMemo(() => tripLegs(trip), [trip]);

  const toggle = (list: string[], v: string, single?: string[]) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list.filter((x) => !single?.includes(x)), v];

  function cancel() {
    abortRef.current?.abort("cancel");
  }

  async function generate() {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const hadPlan = Boolean(plan);
    const startedAt = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    const giveUp = setTimeout(() => controller.abort("timeout"), CLIENT_TIMEOUT_MS);
    setBusy(true);
    setError(null);
    setInfo(null);
    setElapsed(0);
    setProgress(null);
    const body = {
      request,
      preferences: prefs,
      answers,
      trip: {
        home: trip.home,
        departDate: trip.departDate,
        adults: trip.adults,
        cabin: trip.cabin,
        returnHome: trip.returnHome,
        stops: trip.stops.map((s) => ({ city: s.city, nights: s.nights })),
        modes: legs.filter((l) => l.kind === "between").map((l) => l.mode),
        saved: Object.fromEntries(Object.entries(trip.saved ?? {}).map(([c, list]) => [c, list.map((p) => p.name)])),
      },
    };
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson, application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const j = await readPlan(res, setProgress);
      const saved: SavedPlan = {
        createdAt: new Date().toISOString(),
        source: j.source,
        request,
        preferences: prefs,
        answers,
        forStops: stopSignature(trip),
        response: j.response as PlanResponse,
        official: j.official ?? [],
        models: j.models,
        usedBackup: j.usedBackup,
        notice: j.source === "gemini" ? j.notice : undefined,
      };
      dispatch({ type: "plan", plan: saved });
      setView("days");
    } catch (e) {
      if (controller.signal.aborted && controller.signal.reason === "cancel") {
        setInfo(hadPlan ? "Stopped. Your previous plan is unchanged." : "Stopped. Nothing was changed.");
      } else if (controller.signal.aborted) {
        setError("This took longer than it should, so I stopped. Gemini may be busy: wait a minute, then try again.");
      } else if (e instanceof PlanFailure) {
        setError(e.message);
      } else {
        setError("Couldn't reach the planner. Check your connection, then try again.");
      }
    } finally {
      clearInterval(tick);
      clearTimeout(giveUp);
      abortRef.current = null;
      setBusy(false);
    }
  }

  const resp = plan?.response;
  const byCity = useMemo(() => {
    const groups: { city: string; days: { day: PlanDay; n: number }[] }[] = [];
    resp?.days.forEach((day, i) => {
      const last = groups[groups.length - 1];
      if (last && last.city === day.city) last.days.push({ day, n: i + 1 });
      else groups.push({ city: day.city, days: [{ day, n: i + 1 }] });
    });
    return groups;
  }, [resp]);

  const stops = stopsWithDates(trip);
  const official: Official[] = plan?.official ?? [];

  return (
    <section className="concierge" aria-label="Trip concierge">
      <div className="concierge-ask scroll-y">
        <div className="flex items-center justify-between">
          <button type="button" className="btn btn-ghost -ml-3 !px-3 !text-[13.5px]" onClick={onClose}>
            <ArrowIcon size={14} className="rotate-180" /> Route
          </button>
        </div>

        <header className="flex flex-col gap-2">
          <div className="eyebrow !text-accent">Trip concierge</div>
          <h2 className="display text-[34px] leading-[1.08]">Plan your days</h2>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Tell me what you love. Share a little and I&apos;ll suggest and ask a few questions; share a lot and the plan becomes yours.
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <label htmlFor="concierge-request" className="text-[14px] font-medium">What kind of trip is this?</label>
          <textarea
            id="concierge-request"
            rows={4}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="First time in China. We love food markets, quiet temples and design hotels, and we'd rather not start too early."
            className="field !h-auto resize-y !py-3 !text-[15px] leading-relaxed"
          />
        </div>

        <ChipGroup label="Interests" options={INTERESTS} selected={prefs} onToggle={(v) => setPrefs((p) => toggle(p, v))} />
        <ChipGroup label="Pace" options={PACE} selected={prefs} onToggle={(v) => setPrefs((p) => toggle(p, v, PACE))} />
        <ChipGroup label="Comfort" options={COMFORT} selected={prefs} onToggle={(v) => setPrefs((p) => toggle(p, v, COMFORT))} />

        {resp && resp.questions.length > 0 && (
          <div className="concierge-questions">
            <div className="text-[15px] font-medium">To tailor it further</div>
            {resp.questions.map((q) => (
              <ChipGroup
                key={q.id}
                label={q.question}
                options={q.options}
                selected={answers[q.id] ?? []}
                onToggle={(v) => setAnswers((a) => ({ ...a, [q.id]: q.multi ? toggle(a[q.id] ?? [], v) : (a[q.id] ?? []).includes(v) ? [] : [v] }))}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-primary !h-12 w-full !text-[15px]" disabled={busy} onClick={generate}>
            <SparkIcon size={16} />
            {busy ? "Writing your itinerary…" : resp ? "Update my itinerary" : "Write my itinerary"}
          </button>
          {busy ? (
            <div className="flex flex-col items-center gap-2 pt-1" role="status">
              <PlaneLoader label="Writing your itinerary" />
              <p className="text-center text-[13.5px] text-ink-2">{progress ?? stageFor(elapsed)}</p>
              <p className="data text-center text-[12px] text-ink-3">{elapsed}s · usually under a minute</p>
              <button type="button" className="btn btn-ghost !h-9 !px-4 !text-[13.5px]" onClick={cancel}>
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-center text-[12.5px] text-ink-3">Uses your route, dates and saved places.</p>
          )}
          {error && <p className="rounded-md px-3 py-2 text-[13.5px] text-[var(--bad)]" style={{ background: "var(--surface-sunk)" }}>{error}</p>}
          {info && <p className="rounded-md px-3 py-2 text-[13.5px] text-ink-2" style={{ background: "var(--surface-sunk)" }}>{info}</p>}
        </div>
      </div>

      <div className="concierge-plan scroll-y" aria-busy={busy} aria-live="polite">
        {!resp ? (
          <div className="concierge-empty">
            <SparkIcon size={28} className="text-accent" />
            <h3 className="display text-[28px] leading-tight">Your day-by-day plan will appear here</h3>
            <p className="max-w-[46ch] text-[15px] leading-relaxed text-ink-2">
              A full itinerary for {stops.length ? stops.map((s) => s.cityInfo.name).join(", ") : "your trip"}: sights grouped by neighbourhood,
              meals worth planning around, easy arrival days, and a &ldquo;Before you go&rdquo; brief on visas, money, phones and etiquette.
            </p>
          </div>
        ) : (
          <div className={`flex flex-col gap-6 ${busy ? "opacity-50" : ""}`}>
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow">{plan!.source === "sample" ? "Sample plan" : `Written ${fmtShort(plan!.createdAt)}`}</span>
                {plan!.source === "sample" && <span className="chip chip-warn">Add a Gemini key for a personal plan</span>}
                {outdated && <span className="chip chip-warn">Route changed since this plan. Update it.</span>}
              </div>
              <h2 className="display text-[38px] leading-[1.05]">{resp.title}</h2>
              {resp.summary && <p className="max-w-[62ch] text-[16px] leading-relaxed text-ink-2">{resp.summary}</p>}
              {plan!.notice && (
                <p className="max-w-[62ch] rounded-md px-3 py-2 text-[13.5px] text-ink-2" style={{ background: "var(--surface-sunk)" }}>{plan!.notice}</p>
              )}
              {plan!.source === "gemini" && plan!.models && plan!.models.length > 0 && (
                <p className="data text-[11.5px] text-ink-3">
                  Written by {plan!.models.join(" and ")}
                  {plan!.usedBackup ? (plan!.models.length > 1 ? " (a backup model helped)" : " (backup model)") : ""}
                </p>
              )}
            </header>

            {resp.routeSuggestion && resp.routeSuggestion.stops.length > 0 && (
              <div className="route-suggestion">
                <div className="eyebrow !text-accent">Suggested route</div>
                <p className="text-[15px] leading-relaxed">{resp.routeSuggestion.reason}</p>
                <p className="display text-[19px]">
                  {resp.routeSuggestion.stops.map((s) => `${findCity(s.city)?.name ?? s.city} · ${s.nights}n`).join("  →  ")}
                </p>
                <div>
                  <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "replaceStops", stops: resp.routeSuggestion!.stops })}>
                    Use this route
                  </button>
                </div>
              </div>
            )}

            <div className="segmented self-start" role="tablist" aria-label="Plan sections">
              <button type="button" role="tab" aria-selected={view === "days"} onClick={() => setView("days")}>Day by day</button>
              <button type="button" role="tab" aria-selected={view === "before"} onClick={() => setView("before")}>Before you go</button>
            </div>

            {view === "days" ? (
              byCity.length === 0 ? (
                <p className="text-[15px] text-ink-2">Choose your cities (or use the suggested route), then update the plan to see each day.</p>
              ) : (
                byCity.map((g) => {
                  const city = findCity(g.city);
                  return (
                    <section key={`${g.city}-${g.days[0].n}`} className="flex flex-col gap-3">
                      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                        <h3 className="display text-[26px]">
                          {city?.name ?? g.city}
                          {city?.localName && <span className="ml-2 text-[15px] text-ink-3">{city.localName}</span>}
                        </h3>
                        <button type="button" className="text-[13px] font-medium text-accent hover:underline" onClick={() => onOpenCity(g.city)}>
                          Stays, sights &amp; food
                        </button>
                      </div>
                      {g.days.map(({ day, n }) => (
                        <article key={day.date} className="day-card">
                          <div className="day-date">
                            <span className="eyebrow">Day {n}</span>
                            <span className="data text-[13px] text-ink-2">{fmtDay(day.date)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="display text-[20px] leading-snug">{day.title}</h4>
                            <ol className="mt-3 flex flex-col gap-3">
                              {day.items.map((it, i) => {
                                const Icon = KIND_ICON[it.kind];
                                return (
                                  <li key={i} className="flex gap-3">
                                    <span className="day-icon"><Icon size={15} /></span>
                                    <span className="min-w-0">
                                      <span className="eyebrow !text-[10px]">{it.time}</span>
                                      {it.placeName && onOpenPlace ? (
                                        <button
                                          type="button"
                                          className="block text-left text-[15px] leading-snug underline decoration-[var(--line-strong)] underline-offset-4 hover:text-accent hover:decoration-[var(--accent)]"
                                          onClick={() => onOpenPlace(day.city, it.placeName!)}
                                          aria-label={`${it.title}: open ${it.placeName} in the city guide`}
                                        >
                                          {it.title}
                                        </button>
                                      ) : (
                                        <span className="block text-[15px] leading-snug">{it.title}</span>
                                      )}
                                      {it.note && <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-2">{it.note}</span>}
                                    </span>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        </article>
                      ))}
                    </section>
                  );
                })
              )
            ) : (
              <div className="flex flex-col gap-3">
                {[...resp.beforeYouGo].sort((a, b) => Number(b.important) - Number(a.important)).map((b) => (
                  <article key={b.topic} className={`brief ${b.important ? "important" : ""}`}>
                    <h4 className="display text-[19px]">{b.topic}</h4>
                    <p className="text-[15px] leading-relaxed">{b.summary}</p>
                    {b.details.length > 0 && (
                      <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-ink-2">
                        {b.details.map((d) => (
                          <li key={d} className="flex gap-2"><span className="mt-[9px] h-1 w-1 flex-none rounded-full bg-[var(--accent)]" />{d}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
                {official.length > 0 && (
                  <article className="brief">
                    <h4 className="display text-[19px]">Check the official sources</h4>
                    <p className="text-[14px] text-ink-2">Entry rules change. Confirm with these before you book.</p>
                    {official.map((o) => (
                      <div key={o.country} className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                        <span className="font-medium">{o.country}:</span>
                        {o.links.map((l) => (
                          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline">
                            {l.label} <ExternalIcon size={11} />
                          </a>
                        ))}
                      </div>
                    ))}
                  </article>
                )}
                {plan!.source === "gemini" && <p className="text-[12.5px] text-ink-3">Written by AI from your trip details. Double-check anything important.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[14px] text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" className="pref-chip" aria-pressed={selected.includes(o)} onClick={() => onToggle(o)}>
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
