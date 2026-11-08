"use client";

import { useEffect, useState } from "react";
import { findCity, getCity } from "@/lib/cities";
import type { Cabin } from "@/lib/flights/types";
import { byMonth, cheapestMonthLabel, monthLabel, monthName, monthStats, usd } from "@/lib/deals/maths";
import type { DealsResult, LiveDeal } from "@/lib/deals/types";
import { fmtShort } from "@/lib/format";
import { BoltIcon, ExternalIcon } from "../icons";
import s from "./Home.module.css";

interface Props {
  from: string;
  to?: string;
  /** The chosen departure month (YYYY-MM). */
  month: string;
  nights: number;
  adults: number;
  cabin: Cabin;
  onPickMonth: (month: string) => void;
  onPickDestination: (code: string) => void;
}

type Load = { key: string; data?: DealsResult; error?: string };

/**
 * Deals under the search: fare trends by month and popular destinations
 * (Travelpayouts, cached for hours), and an on-demand live search (SerpApi
 * Google Travel Explore). Sample data is labelled "Sample".
 */
export function DealsSection({ from, to, month, nights, adults, cabin, onPickMonth, onPickDestination }: Props) {
  const key = `${from}|${to ?? ""}`;
  const [load, setLoad] = useState<Load>({ key: "" });
  const [live, setLive] = useState<{ key: string; busy: boolean; data?: DealsResult; error?: string }>({ key: "", busy: false });

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ from, ...(to ? { to } : {}) });
    fetch(`/api/deals?${params}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Deals are unavailable.");
        return json as DealsResult;
      })
      .then((data) => { if (alive) setLoad({ key, data }); })
      .catch((e) => { if (alive) setLoad({ key, error: e instanceof Error ? e.message : "Deals are unavailable." }); });
    return () => { alive = false; };
  }, [from, to, key]);

  const liveKey = [from, to, month, nights, adults, cabin].join("|");
  const searchLive = async () => {
    setLive({ key: liveKey, busy: true });
    try {
      const params = new URLSearchParams({ from, month, nights: String(nights), adults: String(adults), cabin, mode: "live", ...(to ? { to } : {}) });
      const r = await fetch(`/api/deals?${params}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Live deals are unavailable.");
      setLive({ key: liveKey, busy: false, data: json as DealsResult });
    } catch (e) {
      setLive({ key: liveKey, busy: false, error: e instanceof Error ? e.message : "Live deals are unavailable." });
    }
  };

  const data = load.key === key ? load.data : undefined;
  const loading = load.key !== key;
  const sample = data?.source === "sample";
  const months = byMonth(data?.months ?? []);
  const stats = monthStats(months);
  const max = Math.max(...months.map((m) => m.price), 1);
  const chosen = months.find((m) => m.month === month);
  const home = getCity(from);
  const dest = to ? getCity(to) : undefined;
  const liveData = live.key === liveKey ? live.data : undefined;

  return (
    <section className={s.section} aria-labelledby="home-deals" aria-busy={loading}>
      <div className={s.sectionHead}>
        <h2 id="home-deals" className={s.sectionTitle}>Deals from {home.name}</h2>
        <p className={s.sectionNote}>
          {sample ? "Sample prices to show how this works. Real fare trends appear once a Travelpayouts token is set." : "Cheapest fares Aviasales travellers found recently: a guide to when to go, not a quote."}
        </p>
      </div>

      {load.error && <p className={s.quiet}>{load.error}</p>}

      <div className={s.dealGrid}>
        {dest && (
          <div className={s.dealCard} data-wide>
            <div className={s.dealTop}>
              <span className={s.dealRoute}>
                <span className="data">{home.code}</span> → <span className="data">{dest.code}</span> · {dest.name}
              </span>
              {sample && <span className="chip chip-muted">Sample</span>}
            </div>
            {loading ? (
              <div className={`skeleton ${s.dealSkeleton}`} />
            ) : stats ? (
              <>
                <p className={`display ${s.dealHeadline}`}>{cheapestMonthLabel(stats)}</p>
                {chosen && chosen.month !== stats.cheapest.month && <p className={s.dealSub}>Your month: {monthLabel(chosen, stats)}.</p>}
                <div className={s.bars} role="group" aria-label={`Cheapest fare by departure month, ${home.name} to ${dest.name}`}>
                  {months.map((m) => {
                    const label = `${monthName(m.month)} ${m.month.slice(0, 4)}: from ${usd(m.price)}${m === stats.cheapest ? ", cheapest" : ""}`;
                    return (
                      <button
                        key={m.month}
                        type="button"
                        className={s.bar}
                        data-chosen={m.month === month || undefined}
                        data-cheapest={m === stats.cheapest || undefined}
                        onClick={() => onPickMonth(m.month)}
                        aria-label={`${label}. Use this month`}
                        title={label}
                      >
                        <span className={s.barFill} style={{ height: `${Math.max(8, (m.price / max) * 100)}%` }} />
                        <span className={s.barTip} aria-hidden>{usd(m.price)}</span>
                        <span className={s.barLabel} aria-hidden>{monthName(m.month).slice(0, 1)}</span>
                      </button>
                    );
                  })}
                </div>
                <p className={s.quiet}>Average of {stats.count} months: {usd(stats.average)} per person. Tap a month to use it.</p>
              </>
            ) : (
              <p className={s.quiet}>No recent fares for this route. Try live deals below, or a nearby city.</p>
            )}
          </div>
        )}

        {(loading ? [] : data?.popular ?? []).slice(0, dest ? 4 : 6).map((d) => {
          const c = findCity(d.to);
          if (!c) return null;
          return (
            <button key={d.to} type="button" className={s.dealCard} onClick={() => onPickDestination(d.to)}>
              <span className={s.dealTop}>
                <span className={s.dealEyebrow}>Popular</span>
                {sample && <span className="chip chip-muted">Sample</span>}
              </span>
              <span className={`display ${s.dealCity}`}>{c.name}</span>
              <span className={s.dealPrice}>
                from <span className="data">{usd(d.price)}</span>
                {d.departureAt && <span className={s.quiet}> · seen for {fmtShort(d.departureAt)}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className={s.liveBox}>
        <div className={s.liveHead}>
          <div>
            <h3 className={s.liveTitle}><BoltIcon size={14} className={s.liveIcon} /> Live deals</h3>
            <p className={s.quiet}>
              Google Travel Explore prices for {monthName(month)}, {dest ? `toward ${dest.region === "Europe" ? "Europe" : dest.region === "Middle East" ? "the Middle East" : "Asia"}` : "across Asia"}.
              {data?.liveAvailable ? ` Uses 1 of ${data.liveQuota.limit} live searches this month (${data.liveQuota.used} used).` : " Needs a SerpApi key; until then you'll see samples."}
            </p>
          </div>
          <button type="button" className="btn" onClick={searchLive} disabled={live.busy}>
            {live.busy ? "Searching…" : liveData ? "Search again" : "Search live deals"}
          </button>
        </div>
        {live.key === liveKey && live.error && <p className={s.quiet}>{live.error}</p>}
        {liveData && (
          <>
            {liveData.notices.map((n) => <p key={n} className={s.quiet}>{n}</p>)}
            <ul className={s.liveList}>
              {(liveData.live ?? []).slice(0, 8).map((d) => <LiveRow key={`${d.name}-${d.airport}`} d={d} sample={liveData.liveSource === "sample"} onPick={onPickDestination} />)}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function LiveRow({ d, sample, onPick }: { d: LiveDeal; sample: boolean; onPick: (code: string) => void }) {
  return (
    <li className={s.liveRow}>
      <span className={s.liveName}>
        <span className="display">{d.name}</span>
        {d.country && <span className={s.quiet}> {d.country}</span>}
        {sample && <span className="chip chip-muted ml-2">Sample</span>}
      </span>
      <span className={s.liveMeta}>
        {d.startDate && d.endDate ? `${fmtShort(d.startDate)} – ${fmtShort(d.endDate)}` : ""}
        {d.airline ? ` · ${d.airline}` : ""}
        {typeof d.stops === "number" ? ` · ${d.stops === 0 ? "nonstop" : `${d.stops} stop${d.stops > 1 ? "s" : ""}`}` : ""}
      </span>
      <span className={`data ${s.livePrice}`}>{usd(d.price)}</span>
      <span className={s.liveActions}>
        {d.to && <button type="button" className="btn btn-ghost" onClick={() => onPick(d.to!)}>Use</button>}
        {d.link && (
          <a className="btn btn-ghost" href={d.link} target="_blank" rel="noreferrer" aria-label={`See ${d.name} on Google`}>
            <ExternalIcon size={13} />
          </a>
        )}
      </span>
    </li>
  );
}
