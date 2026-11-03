import type { Mode } from "./ground";
import type { Cabin } from "./flights/types";
import { newId, sampleTrip, type FlightPick, type Trip } from "./trip";

export type TripAction =
  | { type: "load"; trip: Trip }
  | { type: "reset" }
  | { type: "title"; title: string }
  | { type: "home"; city: string }
  | { type: "date"; date: string }
  | { type: "returnHome"; value: boolean }
  | { type: "adults"; value: number }
  | { type: "cabin"; value: Cabin }
  | { type: "addStop"; city: string }
  | { type: "removeStop"; id: string }
  | { type: "moveStop"; id: string; dir: -1 | 1 }
  | { type: "nights"; id: string; value: number }
  | { type: "mode"; key: string; mode: Mode }
  | { type: "pick"; legId: string; pick: FlightPick | null };

export function tripReducer(t: Trip, a: TripAction): Trip {
  switch (a.type) {
    case "load":
      return a.trip;
    case "reset":
      return sampleTrip();
    case "title":
      return { ...t, title: a.title };
    case "home":
      return { ...t, home: a.city };
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? { ...t, departDate: a.date } : t;
    case "returnHome":
      return { ...t, returnHome: a.value };
    case "adults":
      return { ...t, adults: Math.max(1, Math.min(9, Math.round(a.value))) };
    case "cabin":
      return { ...t, cabin: a.value };
    case "addStop":
      return { ...t, stops: [...t.stops, { id: newId(), city: a.city, nights: 2 }] };
    case "removeStop":
      return { ...t, stops: t.stops.filter((s) => s.id !== a.id) };
    case "moveStop": {
      const i = t.stops.findIndex((s) => s.id === a.id);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= t.stops.length) return t;
      const stops = [...t.stops];
      [stops[i], stops[j]] = [stops[j], stops[i]];
      return { ...t, stops };
    }
    case "nights":
      return { ...t, stops: t.stops.map((s) => (s.id === a.id ? { ...s, nights: Math.max(1, Math.min(30, a.value)) } : s)) };
    case "mode":
      return { ...t, legModes: { ...t.legModes, [a.key]: a.mode } };
    case "pick": {
      const picks = { ...(t.picks ?? {}) };
      if (a.pick) picks[a.legId] = a.pick;
      else delete picks[a.legId];
      return { ...t, picks };
    }
  }
}
