"use client";

import { useState, type Dispatch } from "react";
import { DESTINATION_CITIES, HOME_CITIES } from "@/lib/cities";
import { estimateLeg, MODES, type Mode } from "@/lib/ground";
import { formatDuration, formatMiles, formatUsd } from "@/lib/geo";
import { fmtRange, fmtShort } from "@/lib/format";
import { stopsWithDates, tripEndDate, tripNights, type FlightPick, type Leg, type Trip } from "@/lib/trip";
import type { TripAction } from "@/lib/tripReducer";
import { CityPicker } from "./CityPicker";
import { ArrowIcon, CloseIcon, DownIcon, MinusIcon, MODE_ICON, MODE_LABEL, PlaneIcon, PlusIcon, UpIcon } from "./icons";

interface Props {
  trip: Trip;
  dispatch: Dispatch<TripAction>;
  legs: Leg[];
  selectedLegId: string | null;
  onSelectLeg: (id: string) => void;
  onExplore: (stopId: string) => void;
}

export function TripBuilder({ trip, dispatch, legs, selectedLegId, onSelectLeg, onExplore }: Props) {
  const [adding, setAdding] = useState(false);
  const [morePax, setMorePax] = useState(trip.adults > 2);
  const stops = stopsWithDates(trip);
  const nights = tripNights(trip);
  const legById = new Map(legs.map((l) => [l.id, l]));
  const outbound = legById.get("outbound");
  const ret = legById.get("return");

  return (
    <section className="panel builder" aria-label="Itinerary">
      <header className="flex flex-col gap-2 border-b border-line px-5 pb-4 pt-4">
        <div className="eyebrow">Itinerary</div>
        <label htmlFor="trip-title" className="sr-only">Trip name</label>
        <input
          id="trip-title"
          value={trip.title}
          onChange={(e) => dispatch({ type: "title", title: e.target.value })}
          className="display -ml-1 w-full rounded-md bg-transparent px-1 text-[28px] leading-tight hover:bg-[var(--surface-sunk)]"
        />
        <p className="text-[13px] text-ink-2">
          {stops.length > 0 ? (
            <>
              {nights} nights · {fmtRange(trip.departDate, tripEndDate(trip))} · {stops.length} {stops.length === 1 ? "city" : "cities"}
            </>
          ) : (
            "Add the city you fly into to begin."
          )}
        </p>
      </header>

      <div className="scroll-y flex min-h-0 flex-1 flex-col gap-5 px-5 py-4">
        {/* Travellers and departure */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
            <span className="eyebrow">Travellers</span>
            <div className="segmented" role="group" aria-label="Number of travellers">
              {[1, 2].map((n) => (
                <button key={n} type="button" aria-pressed={!morePax && trip.adults === n} onClick={() => { setMorePax(false); dispatch({ type: "adults", value: n }); }}>
                  {n === 1 ? "Solo" : "Two"}
                </button>
              ))}
              <button type="button" aria-pressed={morePax} onClick={() => { setMorePax(true); if (trip.adults < 3) dispatch({ type: "adults", value: 3 }); }}>
                Group
              </button>
            </div>
          </div>
          {morePax && (
            <div className="col-span-2 flex items-center justify-between rounded-md border border-line px-3 py-2">
              <span className="text-[13.5px]">Adults</span>
              <Stepper value={trip.adults} min={1} max={9} onChange={(v) => dispatch({ type: "adults", value: v })} label="adults" />
            </div>
          )}
          <div className="col-span-2 flex items-center justify-between gap-2">
            <label htmlFor="cabin" className="eyebrow">Cabin</label>
            <select id="cabin" className="field !h-8 !w-auto !text-[13px]" value={trip.cabin} onChange={(e) => dispatch({ type: "cabin", value: e.target.value as Trip["cabin"] })}>
              <option value="economy">Economy</option>
              <option value="premium">Premium economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Leaving from</span>
            <CityPicker label="Departure city" cities={HOME_CITIES} value={trip.home} onChange={(c) => dispatch({ type: "home", city: c })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="depart-date" className="eyebrow">Depart</label>
            <input id="depart-date" type="date" className="field data !w-[150px] !text-[13px]" value={trip.departDate} onChange={(e) => dispatch({ type: "date", date: e.target.value })} />
          </div>
        </div>

        {/* Route timeline */}
        <ol className="relative flex flex-col" aria-label="Route">
          {outbound && (
            <FlightLegRow leg={outbound} label="Outbound" selected={selectedLegId === "outbound"} onSelect={onSelectLeg} pick={trip.picks?.outbound} />
          )}

          {stops.map((s, i) => {
            const next = stops[i + 1];
            const leg = next ? legById.get(`${s.id}>${next.id}`) : undefined;
            const role = i === 0 ? "Fly in" : i === stops.length - 1 ? "Fly out" : `Stop ${i + 1}`;
            return (
              <li key={s.id} className="flex flex-col">
                <div className="group flex items-start gap-3 py-2">
                  <span className="data mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[var(--accent)] text-[11px] text-[var(--accent)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="eyebrow !text-[10px]">{role}{stops.length === 1 ? " · fly out" : ""}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="display truncate text-[21px] leading-tight">{s.cityInfo.name}</span>
                      {s.cityInfo.localName && <span className="text-[13px] text-ink-3">{s.cityInfo.localName}</span>}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-ink-2">
                      {fmtShort(s.arrive)} – {fmtShort(s.depart)} · {s.cityInfo.countryName}
                    </div>
                    <button type="button" onClick={() => onExplore(s.id)} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                      Stays, sights &amp; food <ArrowIcon size={12} />
                    </button>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Stepper value={s.nights} min={1} max={30} onChange={(v) => dispatch({ type: "nights", id: s.id, value: v })} label={`nights in ${s.cityInfo.name}`} suffix="n" />
                    <div className="flex opacity-70 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <button type="button" className="btn btn-ghost !h-6 !w-6 !p-0" aria-label={`Move ${s.cityInfo.name} earlier`} disabled={i === 0} onClick={() => dispatch({ type: "moveStop", id: s.id, dir: -1 })}><UpIcon size={14} /></button>
                      <button type="button" className="btn btn-ghost !h-6 !w-6 !p-0" aria-label={`Move ${s.cityInfo.name} later`} disabled={i === stops.length - 1} onClick={() => dispatch({ type: "moveStop", id: s.id, dir: 1 })}><DownIcon size={14} /></button>
                      <button type="button" className="btn btn-ghost !h-6 !w-6 !p-0" aria-label={`Remove ${s.cityInfo.name}`} onClick={() => dispatch({ type: "removeStop", id: s.id })}><CloseIcon size={14} /></button>
                    </div>
                  </div>
                </div>
                {leg && (
                  <GroundLegRow
                    leg={leg}
                    selected={selectedLegId === leg.id}
                    onSelect={onSelectLeg}
                    onMode={(m) => dispatch({ type: "mode", key: leg.id, mode: m })}
                    pick={trip.picks?.[leg.id]}
                  />
                )}
              </li>
            );
          })}

          <li className="py-2 pl-9">
            {adding ? (
              <CityPicker
                label="Add a city"
                placeholder="Add a city: Tokyo, Guilin, Seoul…"
                cities={DESTINATION_CITIES}
                exclude={trip.stops.length ? [trip.stops[trip.stops.length - 1].city] : []}
                autoFocus
                onChange={(c) => { dispatch({ type: "addStop", city: c }); setAdding(false); }}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button type="button" className="btn !h-8 !text-[13px]" onClick={() => setAdding(true)}>
                <PlusIcon size={14} /> {stops.length ? "Add a stop" : "Add the city you fly into"}
              </button>
            )}
          </li>

          {stops.length > 0 && (
            <li className="flex items-center justify-between gap-2 border-t border-line pt-3">
              <label htmlFor="return-home" className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                <input id="return-home" type="checkbox" className="accent-[var(--accent)]" checked={trip.returnHome} onChange={(e) => dispatch({ type: "returnHome", value: e.target.checked })} />
                Fly home from {stops[stops.length - 1].cityInfo.name}
              </label>
            </li>
          )}
          {ret && <FlightLegRow leg={ret} label="Return" selected={selectedLegId === "return"} onSelect={onSelectLeg} pick={trip.picks?.return} />}
        </ol>
      </div>

      <TripTotals trip={trip} legs={legs} />
    </section>
  );
}

function Stepper({ value, min, max, onChange, label, suffix }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; suffix?: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line px-0.5" role="group" aria-label={label}>
      <button type="button" className="btn btn-ghost !h-6 !w-6 !p-0" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}><MinusIcon size={13} /></button>
      <span className="data w-7 text-center text-[12.5px]" aria-live="polite">{value}{suffix}</span>
      <button type="button" className="btn btn-ghost !h-6 !w-6 !p-0" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}><PlusIcon size={13} /></button>
    </div>
  );
}

function FlightLegRow({ leg, label, selected, onSelect, pick }: { leg: Leg; label: string; selected: boolean; onSelect: (id: string) => void; pick?: FlightPick }) {
  const valid = pick && pick.date === leg.date;
  return (
    <li className="py-1">
      <button
        type="button"
        onClick={() => onSelect(leg.id)}
        aria-pressed={selected}
        className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
        style={{ borderColor: selected ? "var(--accent)" : "var(--line)", background: selected ? "var(--accent-soft)" : "transparent" }}
      >
        <PlaneIcon size={16} className="flex-none text-accent" />
        <span className="min-w-0 flex-1">
          <span className="eyebrow !text-[10px]">{label} flight · {fmtShort(leg.date)}</span>
          <span className="data block text-[13.5px]">
            {leg.from.code} <span className="text-ink-3">→</span> {leg.to.code}
            <span className="ml-2 text-[12px] text-ink-3">{formatMiles(leg.distanceKm)}</span>
          </span>
        </span>
        <span className="text-right text-[12.5px]">
          {valid ? (
            <>
              <span className="data block">{formatUsd(pick.priceTotal)}</span>
              <span className="text-ink-3">{pick.airlines[0]}</span>
            </>
          ) : (
            <span className="text-accent">Compare fares</span>
          )}
        </span>
      </button>
    </li>
  );
}

function GroundLegRow({ leg, selected, onSelect, onMode, pick }: { leg: Leg; selected: boolean; onSelect: (id: string) => void; onMode: (m: Mode) => void; pick?: { priceTotal: number; date: string } }) {
  const est = estimateLeg(leg.from, leg.to, leg.mode);
  const isFlight = leg.mode === "flight";
  const color = isFlight ? "var(--accent)" : "var(--ground)";
  return (
    <div className="ml-3 flex gap-3 border-l-2 border-dashed py-1 pl-5" style={{ borderColor: color }}>
      <div
        className="flex w-full flex-col gap-2 rounded-lg border px-3 py-2"
        style={{ borderColor: selected ? color : "var(--line)", background: selected ? (isFlight ? "var(--accent-soft)" : "var(--ground-soft)") : "transparent" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-0.5" role="radiogroup" aria-label={`How to get from ${leg.from.name} to ${leg.to.name}`}>
            {MODES.map((m) => {
              const Icon = MODE_ICON[m];
              const on = leg.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={MODE_LABEL[m]}
                  title={MODE_LABEL[m]}
                  onClick={() => { onMode(m); onSelect(leg.id); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                  style={{ background: on ? color : "transparent", color: on ? "var(--surface-solid)" : "var(--ink-3)" }}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => onSelect(leg.id)} className="text-[12px] font-medium" style={{ color }}>
            {isFlight ? "Compare fares" : "Details"}
          </button>
        </div>
        <button type="button" onClick={() => onSelect(leg.id)} className="flex items-baseline justify-between gap-2 text-left text-[12.5px]">
          <span className="text-ink-2">
            {MODE_LABEL[leg.mode]} · {fmtShort(leg.date)}
          </span>
          <span className="data">
            {formatDuration(est.durationMin)} · {isFlight && pick && pick.date === leg.date ? formatUsd(pick.priceTotal) : `~${formatUsd(est.priceUsd)}`}
          </span>
        </button>
      </div>
    </div>
  );
}

function TripTotals({ trip, legs }: { trip: Trip; legs: Leg[] }) {
  let flights = 0;
  let ground = 0;
  let unpriced = 0;
  for (const l of legs) {
    const pick = trip.picks?.[l.id];
    if (l.mode === "flight") {
      if (pick && pick.date === l.date) flights += pick.priceTotal;
      else unpriced++;
    } else {
      const e = estimateLeg(l.from, l.to, l.mode);
      ground += e.priceBasis === "per person" ? e.priceUsd * trip.adults : e.priceUsd;
    }
  }
  return (
    <footer className="flex items-end justify-between gap-3 border-t border-line px-5 py-3">
      <div className="text-[12px] leading-snug text-ink-2">
        <div>Flights {flights ? <span className="data text-ink">{formatUsd(flights)}</span> : "—"}{unpriced > 0 && <span className="text-ink-3"> · {unpriced} to choose</span>}</div>
        <div>Ground ~<span className="data text-ink">{formatUsd(ground)}</span> <span className="text-ink-3">· {trip.adults} {trip.adults === 1 ? "traveller" : "travellers"}</span></div>
      </div>
      <div className="text-right">
        <div className="eyebrow !text-[10px]">Transport so far</div>
        <div className="data text-[20px] leading-tight">{formatUsd(flights + ground)}</div>
      </div>
    </footer>
  );
}
