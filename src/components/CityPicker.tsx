"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { findCity, REGION_ORDER, type City } from "@/lib/cities";
import { distanceKm } from "@/lib/geo";

interface Props {
  cities: City[];
  value?: string;
  onChange: (code: string) => void;
  placeholder?: string;
  label: string;
  exclude?: string[];
  autoFocus?: boolean;
  onCancel?: () => void;
  /**
   * Codes of the cities already in the trip. When set, a "Popular for your
   * trip" group comes first: cities in the same country or region, nearest
   * to the last stop. Defaults to none.
   */
  tripCities?: string[];
}

export interface PickerGroup {
  key: string;
  /** Region eyebrow, shown on the first group of each section. */
  section?: string;
  /** Country sub-header; absent for single-city countries and the popular group. */
  heading?: string;
  /** Show the country on each row (when there is no country sub-header). */
  showCountry: boolean;
  cities: City[];
}

const NONE: string[] = [];
const POPULAR_LIMIT = 8;

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** 0 = exact, 1 = starts with, 2 = a word starts with, 3 = contains; Infinity = no match. */
export function matchScore(c: City, query: string): number {
  const q = fold(query.trim());
  if (!q) return 3;
  const fields = [c.name, c.code, c.flightCode ?? "", c.countryName, c.localName ?? "", c.wikivoyageTitle ?? "", ...c.airports]
    .filter(Boolean)
    .map(fold);
  let best = Infinity;
  for (const f of fields) {
    if (f === q) return 0;
    if (f.startsWith(q)) best = Math.min(best, 1);
    else if (f.split(/[\s,'’-]+/).some((w) => w.startsWith(q))) best = Math.min(best, 2);
    else if (f.includes(q)) best = Math.min(best, 3);
  }
  return best;
}

/** Popular group, then region → country groups. Pure, so it is easy to test. */
export function pickerGroups(cities: City[], query: string, exclude: string[], tripCities: string[]): PickerGroup[] {
  const available = cities.filter((c) => !exclude.includes(c.code));
  const q = query.trim();
  const matches = q ? available.filter((c) => matchScore(c, q) < Infinity) : available;
  const groups: PickerGroup[] = [];

  if (!q && tripCities.length) {
    const anchors = tripCities.map((code) => findCity(code)).filter((c): c is City => !!c && c.country !== "US");
    const last = anchors[anchors.length - 1];
    if (last) {
      const countries = new Set(anchors.map((c) => c.country));
      const regions = new Set(anchors.map((c) => c.region));
      const popular = available
        .filter((c) => !tripCities.includes(c.code) && (countries.has(c.country) || regions.has(c.region)))
        .sort(
          (a, b) =>
            Number(!countries.has(a.country)) - Number(!countries.has(b.country)) ||
            distanceKm(last, a) - distanceKm(last, b),
        )
        .slice(0, POPULAR_LIMIT);
      if (popular.length) groups.push({ key: "popular", section: "Popular for your trip", showCountry: true, cities: popular });
    }
  }

  const countryOrder = new Map<string, number>();
  cities.forEach((c) => { if (!countryOrder.has(c.country)) countryOrder.set(c.country, countryOrder.size); });

  for (const region of REGION_ORDER) {
    const inRegion = matches.filter((c) => c.region === region);
    const byCountry = new Map<string, City[]>();
    for (const c of inRegion) byCountry.set(c.country, [...(byCountry.get(c.country) ?? []), c]);
    const countries = [...byCountry.keys()].sort((a, b) => countryOrder.get(a)! - countryOrder.get(b)!);
    countries.forEach((country, i) => {
      const list = byCountry.get(country)!.sort((a, b) => a.name.localeCompare(b.name));
      const multi = list.length > 1;
      groups.push({
        key: `${region}-${country}`,
        section: i === 0 ? region : undefined,
        heading: multi ? list[0].countryName : undefined,
        showCountry: !multi,
        cities: list,
      });
    });
  }
  return groups;
}

/**
 * Accessible combobox: type to filter (city, country, local name or airport
 * code), arrows or Page Up/Down to move, Enter to choose, Esc to cancel.
 */
export function CityPicker({ cities, value, onChange, placeholder, label, exclude = NONE, autoFocus, onCancel, tripCities = NONE }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(Boolean(autoFocus));
  // -1 means "the best match for the query", so typing highlights the likeliest city.
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = cities.find((c) => c.code === value);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const groups = useMemo(() => pickerGroups(cities, query, exclude, tripCities), [cities, query, exclude, tripCities]);

  const options = useMemo(
    () => groups.flatMap((g) => g.cities.map((city) => ({ city, optionId: `${id}-${g.key === "popular" ? "pop" : "all"}-${city.code}` }))),
    [groups, id],
  );

  const best = useMemo(() => {
    if (!query.trim()) return 0;
    let bi = 0;
    let bs = Infinity;
    options.forEach((o, i) => {
      const s = matchScore(o.city, query);
      if (s < bs) { bs = s; bi = i; }
    });
    return bi;
  }, [options, query]);

  const activeIndex = options.length ? Math.min(active < 0 ? best : active, options.length - 1) : -1;
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  useEffect(() => {
    if (open && activeOption) document.getElementById(activeOption.optionId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeOption]);

  const choose = (c: City) => {
    onChange(c.code);
    setQuery("");
    setActive(-1);
    setOpen(false);
  };

  const move = (delta: number) => {
    setOpen(true);
    setActive(Math.max(0, Math.min(activeIndex + delta, options.length - 1)));
  };

  const starts = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.cities.length, 0));

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        ref={inputRef}
        id={id}
        className={`field ${current ? "placeholder:text-[var(--ink)]" : ""}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && activeOption ? activeOption.optionId : undefined}
        autoComplete="off"
        placeholder={current ? `${current.name}, ${current.countryName}` : placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { setOpen(false); onCancel?.(); }, 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); move(open ? 1 : 0); }
          else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
          else if (e.key === "PageDown") { e.preventDefault(); move(8); }
          else if (e.key === "PageUp") { e.preventDefault(); move(-8); }
          else if (e.key === "Enter" && open && activeOption) { e.preventDefault(); choose(activeOption.city); }
          else if (e.key === "Escape") { setOpen(false); onCancel?.(); }
        }}
      />
      {open && options.length > 0 && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="panel scroll-y absolute left-0 right-0 top-[42px] z-30 max-h-80 p-1"
          style={{ background: "var(--surface-solid)" }}
        >
          {groups.map((g, gi) => (
            <div key={g.key} role="group" aria-label={[g.section, g.heading].filter(Boolean).join(", ") || g.cities[0].countryName}>
              {g.section && (
                <div role="presentation" className={`eyebrow px-2.5 pb-1 ${g.key === "popular" ? "pt-2" : "mt-1 border-t border-line pt-3 first:mt-0 first:border-t-0 first:pt-2"}`}>
                  {g.section}
                </div>
              )}
              {g.heading && (
                <div role="presentation" className="px-2.5 pb-0.5 pt-1.5 text-[11.5px] font-medium tracking-wide text-ink-3">
                  {g.heading}
                </div>
              )}
              {g.cities.map((c, j) => {
                const i = starts[gi] + j;
                const opt = options[i];
                const isActive = i === activeIndex;
                return (
                  <div
                    key={opt.optionId}
                    id={opt.optionId}
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                    onMouseEnter={() => setActive(i)}
                    className="flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-2.5 py-1.5"
                    style={{ background: isActive ? "var(--surface-sunk)" : undefined }}
                  >
                    <span className="min-w-0 truncate">
                      <span className="display text-[15px]">{c.name}</span>
                      {c.localName && <span className="ml-1.5 text-[13px] text-ink-3">{c.localName}</span>}
                      {g.showCountry && <span className="ml-2 text-[12.5px] text-ink-3">{c.countryName}</span>}
                    </span>
                    <span
                      className="data shrink-0 text-[11.5px] text-ink-3"
                      title={c.flightCode ? `No airport of its own; flights use ${c.flightCode}` : undefined}
                    >
                      {c.flightCode ? `via ${c.flightCode}` : c.code}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
