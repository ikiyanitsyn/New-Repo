"use client";

import { useState } from "react";
import { DESTINATION_CITIES, getCity } from "@/lib/cities";
import { searchKey, type SearchCity } from "@/lib/newTrip";
import { CityPicker } from "../CityPicker";
import { CloseIcon, DownIcon, PlusIcon, UpIcon } from "../icons";
import s from "./Home.module.css";
import { Stepper } from "./Stepper";

const MAX_CITIES = 8;

/** Multi-city: a short ordered list of cities with nights; the trip flies home from the last one. */
export function MultiCityList({ cities, onChange, missing }: { cities: SearchCity[]; onChange: (c: SearchCity[]) => void; missing?: boolean }) {
  const [adding, setAdding] = useState(cities.length === 0);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cities.length) return;
    const next = [...cities];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (code: string) => {
    onChange([...cities, { key: searchKey(), city: code, nights: 3 }]);
    setAdding(false);
  };

  return (
    <div className={s.multi} data-missing={missing || undefined}>
      <ol className={s.multiList} aria-label="Cities in order">
        {cities.map((c, i) => {
          const city = getCity(c.city);
          return (
            <li key={c.key} className={s.multiRow}>
              <span className={`data ${s.multiNum}`} aria-hidden>{i + 1}</span>
              <span className={s.multiName}>
                <span className="display">{city.name}</span>
                <span className={s.multiCountry}>{city.countryName}</span>
              </span>
              <Stepper compact value={c.nights} min={1} max={30} unit={c.nights === 1 ? "night" : "nights"} label={`Nights in ${city.name}`} onChange={(n) => onChange(cities.map((x) => (x.key === c.key ? { ...x, nights: n } : x)))} />
              <span className={s.multiTools}>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${city.name} earlier`}><UpIcon size={14} /></button>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => move(i, 1)} disabled={i === cities.length - 1} aria-label={`Move ${city.name} later`}><DownIcon size={14} /></button>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => onChange(cities.filter((x) => x.key !== c.key))} aria-label={`Remove ${city.name}`}><CloseIcon size={14} /></button>
              </span>
            </li>
          );
        })}
      </ol>
      {adding ? (
        <div className={s.multiAdd}>
          <CityPicker
            cities={DESTINATION_CITIES}
            onChange={add}
            placeholder="Search a city, e.g. Kyoto"
            label="Add a city"
            exclude={cities.map((c) => c.city)}
            tripCities={cities.map((c) => c.city)}
            autoFocus={cities.length > 0}
            onCancel={() => cities.length && setAdding(false)}
          />
        </div>
      ) : (
        cities.length < MAX_CITIES && (
          <button type="button" className={s.addCity} onClick={() => setAdding(true)}>
            <PlusIcon size={14} /> Add a city
          </button>
        )
      )}
      {cities.length > 0 && <p className={s.multiHint}>You fly home from {getCity(cities[cities.length - 1].city).name}.</p>}
    </div>
  );
}
