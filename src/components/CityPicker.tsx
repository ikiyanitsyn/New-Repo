"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { REGION_ORDER, type City } from "@/lib/cities";

interface Props {
  cities: City[];
  value?: string;
  onChange: (code: string) => void;
  placeholder?: string;
  label: string;
  exclude?: string[];
  autoFocus?: boolean;
  onCancel?: () => void;
}

/** Accessible combobox: type to filter, arrows to move, Enter to choose, Esc to cancel. */
export function CityPicker({ cities, value, onChange, placeholder, label, exclude = [], autoFocus, onCancel }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(Boolean(autoFocus));
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = cities.find((c) => c.code === value);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cities
      .filter((c) => !exclude.includes(c.code))
      .filter((c) => !q || [c.name, c.code, c.countryName, c.localName ?? "", ...c.airports].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => REGION_ORDER.indexOf(a.region) - REGION_ORDER.indexOf(b.region));
  }, [cities, exclude, query]);

  const choose = (c: City) => {
    onChange(c.code);
    setQuery("");
    setOpen(false);
  };

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
        aria-activedescendant={open && results[active] ? `${id}-${results[active].code}` : undefined}
        autoComplete="off"
        placeholder={current ? `${current.name}, ${current.countryName}` : placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { setOpen(false); onCancel?.(); }, 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && open && results[active]) { e.preventDefault(); choose(results[active]); }
          else if (e.key === "Escape") { setOpen(false); onCancel?.(); }
        }}
      />
      {open && results.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="panel scroll-y absolute left-0 right-0 top-[42px] z-30 max-h-72 p-1"
          style={{ background: "var(--surface-solid)" }}
        >
          {results.map((c, i) => {
            const showRegion = i === 0 || results[i - 1].region !== c.region;
            return (
              <li key={c.code} role="presentation">
                {showRegion && <div className="eyebrow px-2.5 pb-1 pt-2">{c.region}</div>}
                <div
                  id={`${id}-${c.code}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                  onMouseEnter={() => setActive(i)}
                  className="flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-2.5 py-1.5"
                  style={{ background: i === active ? "var(--surface-sunk)" : undefined }}
                >
                  <span className="min-w-0 truncate">
                    <span className="display text-[15px]">{c.name}</span>
                    {c.localName && <span className="ml-1.5 text-[13px] text-ink-3">{c.localName}</span>}
                    <span className="ml-2 text-[12.5px] text-ink-3">{c.countryName}</span>
                  </span>
                  <span className="data text-[11.5px] text-ink-3">{c.code}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
