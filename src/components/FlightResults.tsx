"use client";

import { useEffect, useMemo, useState } from "react";
import { applyLayoverFilter, connectionAirports, isDefaultFilter, NO_LAYOVER_FILTER, type LayoverFilter } from "@/lib/flights/layover";
import { BEST_PRICE_WEIGHT, paretoIds, sortOffers, type SortMode } from "@/lib/flights/rank";
import type { Cabin, FlightOffer, FlightSearchResult } from "@/lib/flights/types";
import { formatDuration, formatMiles, formatUsd } from "@/lib/geo";
import { dayDiff, fmtDay, fmtTime } from "@/lib/format";
import type { FlightPick, Leg, Trip } from "@/lib/trip";
import { BoltIcon, ExternalIcon, PlaneIcon } from "./icons";
import { SplitFlap } from "./SplitFlap";
import { CollapseButton } from "./planner/CollapseButton";
import { FareDetails } from "./planner/FareDetails";
import { LayoverControls } from "./planner/LayoverControls";
import { PriceStrip } from "./planner/PriceStrip";

interface Props {
  leg: Leg;
  trip: Trip;
  pick?: FlightPick;
  onPick: (pick: FlightPick | null) => void;
  /** Move the trip's departure date (outbound flight only). */
  onPickDate?: (date: string) => void;
  onCollapse?: () => void;
}

const SOURCE_LABEL: Record<FlightSearchResult["source"], { text: string; cls: string; detail: string }> = {
  sample: { text: "Sample fares", cls: "chip-warn", detail: "Invented for layout. Not real prices." },
  travelpayouts: { text: "Recent fares · Aviasales", cls: "chip-muted", detail: "From recent searches, so a few hours to days old." },
  serpapi: { text: "Live · Google Flights", cls: "chip-accent", detail: "Checked just now." },
};

export function FlightResults({ leg, trip, pick, onPick, onPickDate, onCollapse }: Props) {
  const [sort, setSort] = useState<SortMode>("best");
  const [filter, setFilter] = useState<LayoverFilter>(NO_LAYOVER_FILTER);
  // Pressing "Check live prices" sends the stops and layover choices of that moment to SerpApi.
  // Later changes filter the results in the browser, so they never spend another live search.
  const [live, setLive] = useState<LayoverFilter | null>(null);
  // The parent remounts this component when the route, date or travellers change.
  const params = new URLSearchParams({
    from: leg.from.code, to: leg.to.code, date: leg.date,
    adults: String(trip.adults), cabin: trip.cabin, mode: live ? "live" : "cached",
    ...(live ? { stops: live.maxStops === null ? "any" : String(live.maxStops), ...(live.minHours !== null ? { layMin: String(live.minHours) } : {}), ...(live.maxHours !== null ? { layMax: String(live.maxHours) } : {}) } : {}),
  }).toString();
  const [state, setState] = useState<{ key: string; data?: FlightSearchResult; error?: string } | null>(null);
  const loading = state?.key !== params;
  const data = state?.data ?? null;
  const error = !loading ? state?.error ?? null : null;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/flights?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Search failed");
        setState({ key: params, data: j as FlightSearchResult });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setState((s) => ({ key: params, data: s?.data, error: e.message }));
      });
    return () => ctrl.abort();
  }, [params]);

  const offers = useMemo(() => applyLayoverFilter(data?.offers ?? [], filter), [data, filter]);
  const airports = useMemo(() => connectionAirports(data?.offers ?? []), [data]);
  const sorted = useMemo(() => sortOffers(offers, sort, BEST_PRICE_WEIGHT), [offers, sort]);
  const frontier = useMemo(() => paretoIds(offers), [offers]);
  const cheapest = sorted.length ? Math.min(...offers.map((o) => o.priceTotal)) : 0;
  const fastest = sorted.length ? Math.min(...offers.map((o) => o.durationMin)) : 0;
  const source = data ? SOURCE_LABEL[data.source] : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-y flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b border-line px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">{leg.kind === "outbound" ? "Outbound flight" : leg.kind === "return" ? "Return flight" : "Flight between stops"}</span>
          <span className="flex items-center gap-1.5">
            {source && <span className={`chip ${source.cls}`} title={source.detail}>{source.text}</span>}
            {onCollapse && <CollapseButton onClick={onCollapse} />}
          </span>
        </div>
        <div className="flex items-center gap-2.5" aria-hidden>
          <SplitFlap value={leg.from.code} size="lg" tone="brass" />
          <PlaneIcon size={16} className="text-ink-3" />
          <SplitFlap value={leg.to.code} size="lg" tone="brass" delayMs={160} />
        </div>
        <h2 className="display text-[26px] leading-tight">
          {leg.from.name} <span className="text-ink-3">to</span> {leg.to.name}
        </h2>
        <p className="data text-[12px] text-ink-2">
          {leg.from.airports.join(" · ")} → {leg.to.airports.join(" · ")} · {fmtDay(leg.date)} · {formatMiles(leg.distanceKm)}
        </p>

        <PriceStrip
          from={leg.from.code}
          to={leg.to.code}
          date={leg.date}
          adults={trip.adults}
          cabin={trip.cabin}
          editable={leg.kind === "outbound" && Boolean(onPickDate)}
          onPickDate={(d) => onPickDate?.(d)}
        />

        <div className="segmented self-start" role="tablist" aria-label="Sort fares">
          {(["best", "cheapest", "fastest"] as SortMode[]).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={sort === m} onClick={() => setSort(m)}>
              {m === "best" ? "Best" : m === "cheapest" ? "Cheapest" : "Fastest"}
            </button>
          ))}
        </div>
        <LayoverControls filter={filter} onChange={setFilter} airports={airports} />
      </header>

      <div className="flex flex-col gap-2 px-3 py-3" aria-live="polite" aria-busy={loading}>
        {data?.notices.map((n) => (
          <p key={n} className="mx-2 rounded-md px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-sunk)", color: "var(--ink-2)" }}>{n}</p>
        ))}
        {loading && !data && Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton mx-2 h-[76px]" />)}
        {error && <p className="mx-2 text-[13px] text-[var(--bad)]">{error}. Try again in a moment.</p>}
        {!loading && data && sorted.length === 0 && (
          <p className="mx-2 py-6 text-center text-[13.5px] text-ink-2">
            {isDefaultFilter(filter) ? "No fares found for this date." : "No fares match your stops and layover choices."}
            {!isDefaultFilter(filter) && (
              <>
                {" "}
                <button type="button" className="underline underline-offset-2" onClick={() => setFilter(NO_LAYOVER_FILTER)}>Show all fares</button>
              </>
            )}
          </p>
        )}
        <ul className={`flex flex-col gap-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {sorted.map((o, i) => (
            <OfferRow
              key={o.id}
              offer={o}
              adults={trip.adults}
              cabin={trip.cabin}
              rankLabel={i === 0 ? (sort === "best" ? "Best balance" : sort === "cheapest" ? "Cheapest" : "Fastest") : null}
              isCheapest={o.priceTotal === cheapest}
              isFastest={o.durationMin === fastest}
              onFrontier={frontier.has(o.id)}
              chosen={pick?.offerId === o.id && pick.date === leg.date}
              onChoose={() =>
                onPick(
                  pick?.offerId === o.id && pick.date === leg.date
                    ? null
                    : { offerId: o.id, date: leg.date, priceTotal: o.priceTotal, airlines: o.airlines, durationMin: o.durationMin, stops: o.stops, departLocal: o.departLocal, source: o.source, bookingUrl: o.bookingUrl },
                )
              }
            />
          ))}
        </ul>
      </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-line px-5 py-3">
        {data && !live && (
          <button
            type="button"
            className={`btn w-full ${data.liveAvailable ? "btn-primary" : ""}`}
            disabled={!data.liveAvailable || loading}
            onClick={() => setLive(filter)}
            title={data.liveAvailable ? undefined : "Add a SerpApi key to enable live prices"}
          >
            <BoltIcon size={15} />
            {data.liveAvailable
              ? `Check live prices${data.liveQuota ? ` · ${data.liveQuota.limit - data.liveQuota.used} left this month` : ""}`
              : "Live prices need a SerpApi key"}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          <span className="text-ink-3">Verify and book on</span>
          {data?.links.map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-2 underline decoration-[var(--line-strong)] underline-offset-2 hover:text-ink">
              {l.label} <ExternalIcon size={11} />
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

function OfferRow({
  offer: o, adults, cabin, rankLabel, isCheapest, isFastest, onFrontier, chosen, onChoose,
}: {
  offer: FlightOffer; adults: number; cabin: Cabin; rankLabel: string | null; isCheapest: boolean; isFastest: boolean; onFrontier: boolean; chosen: boolean; onChoose: () => void;
}) {
  const first = o.segments[0];
  const last = o.segments[o.segments.length - 1];
  const arriveDays = o.arriveLocal ? dayDiff(o.departLocal, o.arriveLocal) : 0;
  return (
    <li
      className="mx-1 rounded-lg border px-3.5 py-3 transition-colors"
      style={{ borderColor: chosen ? "var(--accent)" : "var(--line)", background: chosen ? "var(--accent-soft)" : "var(--surface-solid)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[13.5px] font-semibold">{o.airlines.join(" + ")}</span>
            {rankLabel && <span className="chip chip-accent">{rankLabel}</span>}
            {!rankLabel && isCheapest && <span className="chip chip-muted">Cheapest</span>}
            {!rankLabel && isFastest && <span className="chip chip-muted">Fastest</span>}
            {onFrontier && !rankLabel && !isCheapest && !isFastest && <span className="chip chip-muted" title="Nothing else is both cheaper and faster">Good value</span>}
          </div>
          <div className="data mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
            {/* The top-ranked fare's departure flips in like a board; the rest stay quiet. */}
            {rankLabel ? <SplitFlap value={fmtTime(o.departLocal)} size="sm" delayMs={300} /> : <span>{fmtTime(o.departLocal)}</span>}
            <span className="text-ink-3">{first?.from}</span>
            <StopsLine stops={o.stops} />
            <span className="text-ink-3">{last?.to}</span>
            {o.arriveLocal && (
              <span>
                {fmtTime(o.arriveLocal)}
                {arriveDays > 0 && <sup className="ml-0.5 text-[10px] text-[var(--accent)]">+{arriveDays}</sup>}
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-ink-2">
            {formatDuration(o.durationMin)} · {o.stops === 0 ? "Nonstop" : `${o.stops} stop${o.stops > 1 ? "s" : ""}`}
            {o.layovers.length > 0 && (
              <span className="text-ink-3"> · {o.layovers.map((l) => `${l.airport} ${formatDuration(l.durationMin)}`).join(", ")}</span>
            )}
          </div>
          <FareDetails offer={o} cabin={cabin} />
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <div className="text-right">
            <div className="data text-[17px] leading-tight">{formatUsd(o.priceTotal)}</div>
            {adults > 1 && <div className="data text-[11px] text-ink-3">{formatUsd(o.pricePerPerson)} each</div>}
          </div>
          <div className="flex items-center gap-1">
            {o.bookingUrl && (
              <a href={o.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon !h-7 !w-7" aria-label="Open this fare on the booking site">
                <ExternalIcon size={13} />
              </a>
            )}
            <button type="button" className={`btn !h-7 !px-3 !text-[12.5px] ${chosen ? "btn-primary" : ""}`} onClick={onChoose} aria-pressed={chosen}>
              {chosen ? "Chosen" : "Choose"}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function StopsLine({ stops }: { stops: number }) {
  return (
    <span className="relative inline-flex h-3 w-14 flex-none items-center" aria-hidden>
      <span className="h-px w-full" style={{ background: "var(--line-strong)" }} />
      <span className="absolute inset-0 flex items-center justify-evenly">
        {Array.from({ length: stops }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full border" style={{ borderColor: "var(--ink-3)", background: "var(--surface-solid)" }} />
        ))}
      </span>
    </span>
  );
}
