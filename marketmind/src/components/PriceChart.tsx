"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Bar } from "@/lib/types";
import { sma } from "@/lib/market/indicators";
import { fmtCompact, fmtPct, fmtPrice } from "@/lib/client/format";

const RANGES = [
  ["1M", 21],
  ["3M", 63],
  ["6M", 126],
  ["1Y", 252],
  ["2Y", 504],
] as const;

const SERIES = [
  { key: "close", label: "Close", color: "var(--s1)", width: 2 },
  { key: "sma50", label: "50-day avg", color: "var(--s2)", width: 1.5 },
  { key: "sma200", label: "200-day avg", color: "var(--s3)", width: 1.5 },
] as const;

export default function PriceChart({ bars, levels }: { bars: Bar[]; levels?: { support: number | null; resistance: number | null } }) {
  const [range, setRange] = useState<number>(126);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  const [show, setShow] = useState({ sma50: true, sma200: true });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const view = useMemo(() => {
    const closes = bars.map((b) => b.c);
    const s50 = sma(closes, 50);
    const s200 = sma(closes, 200);
    const start = Math.max(0, bars.length - range);
    return bars.slice(start).map((b, i) => ({ ...b, sma50: s50[start + i], sma200: s200[start + i] }));
  }, [bars, range]);

  const H = 300;
  const VH = 54;
  const padL = 8;
  const padR = 58;
  const padT = 10;
  const plotW = width - padL - padR;
  const priceH = H - VH - padT - 18;

  const vals = view.flatMap((b) => [b.h, b.l, show.sma50 ? b.sma50 : null, show.sma200 ? b.sma200 : null].filter((x): x is number => x != null));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.06 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const x = (i: number) => padL + (view.length <= 1 ? 0 : (i / (view.length - 1)) * plotW);
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * priceH;
  const vMax = Math.max(...view.map((b) => b.v), 1);

  const path = (key: "c" | "sma50" | "sma200") => {
    let d = "";
    let pen = false;
    view.forEach((b, i) => {
      const v = b[key];
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const ticks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * (i + 0.5)) / 5);
  const dateTicks = [0, Math.floor(view.length / 3), Math.floor((2 * view.length) / 3), view.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const first = view[0]?.c ?? 0;
  const last = view[view.length - 1]?.c ?? 0;
  const up = last >= first;
  const hb = hover != null ? view[hover] : null;
  const barW = Math.max(1, plotW / view.length - 1);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - padL;
    const i = Math.round((px / plotW) * (view.length - 1));
    setHover(Math.max(0, Math.min(view.length - 1, i)));
  }

  const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: range > 252 ? "2-digit" : undefined });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs soft">
          {SERIES.map((s) => {
            const toggle = s.key !== "close";
            const on = s.key === "close" || show[s.key];
            return (
              <button
                key={s.key}
                type="button"
                disabled={!toggle}
                onClick={() => toggle && setShow((v) => ({ ...v, [s.key]: !v[s.key as "sma50" | "sma200"] }))}
                className={`inline-flex items-center gap-1.5 ${on ? "" : "opacity-40"}`}
                aria-pressed={on}
              >
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
                {s.label}
              </button>
            );
          })}
          <span className={`num ${up ? "up" : "down"}`}>
            {up ? "▲" : "▼"} {fmtPct(first ? last / first - 1 : 0)} over period
          </span>
        </div>
        <div className="seg" role="group" aria-label="Chart range">
          {RANGES.map(([label, n]) => (
            <button key={label} aria-pressed={range === n} onClick={() => setRange(n)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div ref={box} className="relative w-full select-none">
        <svg width={width} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Price chart with moving averages and volume" className="block touch-none">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={padL + plotW + 6} y={y(t) + 4} fontSize={11} fill="var(--ink-3)" className="num">
                {fmtPrice(t)}
              </text>
            </g>
          ))}
          {levels?.support != null && levels.support > yMin && levels.support < yMax && (
            <g>
              <line x1={padL} x2={padL + plotW} y1={y(levels.support)} y2={y(levels.support)} stroke="var(--up-fill)" strokeDasharray="4 4" strokeWidth={1} opacity={0.7} />
              <text x={padL + 4} y={y(levels.support) - 4} fontSize={10} fill="var(--ink-2)">
                Support {fmtPrice(levels.support)}
              </text>
            </g>
          )}
          {levels?.resistance != null && levels.resistance > yMin && levels.resistance < yMax && (
            <g>
              <line x1={padL} x2={padL + plotW} y1={y(levels.resistance)} y2={y(levels.resistance)} stroke="var(--down-fill)" strokeDasharray="4 4" strokeWidth={1} opacity={0.7} />
              <text x={padL + 4} y={y(levels.resistance) - 4} fontSize={10} fill="var(--ink-2)">
                Resistance {fmtPrice(levels.resistance)}
              </text>
            </g>
          )}
          <path d={`${path("c")}L${x(view.length - 1)},${padT + priceH}L${x(0)},${padT + priceH}Z`} fill="var(--s1)" opacity={0.08} />
          {show.sma200 && <path d={path("sma200")} fill="none" stroke="var(--s3)" strokeWidth={1.5} />}
          {show.sma50 && <path d={path("sma50")} fill="none" stroke="var(--s2)" strokeWidth={1.5} />}
          <path d={path("c")} fill="none" stroke="var(--s1)" strokeWidth={2} strokeLinejoin="round" />
          {view.map((b, i) => {
            const h = (b.v / vMax) * (VH - 6);
            const upDay = i === 0 || b.c >= view[i - 1].c;
            return <rect key={b.t} x={x(i) - barW / 2} y={H - 18 - h} width={barW} height={Math.max(h, 0.5)} fill={upDay ? "var(--up-fill)" : "var(--down-fill)"} opacity={hover === i ? 0.7 : 0.28} />;
          })}
          <line x1={padL} x2={padL + plotW} y1={H - 18} y2={H - 18} stroke="var(--line-strong)" />
          {dateTicks.map((i) => (
            <text key={i} x={Math.min(Math.max(x(i), padL + 24), padL + plotW - 24)} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--ink-3)">
              {view[i] ? fmtDate(view[i].t) : ""}
            </text>
          ))}
          {hb && hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - 18} stroke="var(--ink-3)" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(hb.c)} r={4.5} fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hb && hover != null && (
          <div
            className="card pointer-events-none absolute z-10 px-3 py-2 text-xs"
            style={{ top: 8, left: x(hover) > width / 2 ? Math.max(0, x(hover) - 190) : x(hover) + 14, width: 176 }}
          >
            <div className="mb-1 font-semibold">{new Date(hb.t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
            <div className="num grid grid-cols-2 gap-x-2 soft">
              <span>Open</span><span className="text-right">{fmtPrice(hb.o)}</span>
              <span>High</span><span className="text-right">{fmtPrice(hb.h)}</span>
              <span>Low</span><span className="text-right">{fmtPrice(hb.l)}</span>
              <span className="font-semibold" style={{ color: "var(--ink)" }}>Close</span><span className="text-right font-semibold" style={{ color: "var(--ink)" }}>{fmtPrice(hb.c)}</span>
              {hb.sma50 != null && (<><span>50-day</span><span className="text-right">{fmtPrice(hb.sma50)}</span></>)}
              {hb.sma200 != null && (<><span>200-day</span><span className="text-right">{fmtPrice(hb.sma200)}</span></>)}
              <span>Volume</span><span className="text-right">{fmtCompact(hb.v)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
