import type { Mode } from "./ground";
import type { Cabin } from "./flights/types";
import { newId, sampleTrip, type ChosenHotel, type FlightPick, type SavedPlace, type Trip, type TripCost, type TripType } from "./trip";
import type { SavedPlan } from "./ai/schema";

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
  | { type: "pick"; legId: string; pick: FlightPick | null }
  | { type: "toggleSave"; city: string; place: SavedPlace }
  | { type: "plan"; plan: SavedPlan | null }
  | { type: "replaceStops"; stops: { city: string; nights: number; stopover?: boolean }[] }
  | { type: "tripType"; value: TripType }
  | { type: "stopover"; id: string; value: boolean }
  | { type: "travellers"; names: string[] }
  | { type: "hotel"; city: string; hotel: ChosenHotel | null }
  | { type: "confirmation"; key: string; value: string }
  | { type: "dayNote"; date: string; text: string }
  | { type: "addCost"; cost: Omit<TripCost, "id"> & { id?: string } }
  | { type: "removeCost"; id: string }
  | { type: "planResponse"; response: import("./ai/schema").PlanResponse };

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
    case "toggleSave": {
      const list = t.saved?.[a.city] ?? [];
      const has = list.some((p) => p.key === a.place.key);
      const next = has ? list.filter((p) => p.key !== a.place.key) : [...list, a.place];
      return { ...t, saved: { ...(t.saved ?? {}), [a.city]: next } };
    }
    case "plan":
      return a.plan ? { ...t, plan: a.plan } : { ...t, plan: undefined };
    case "replaceStops":
      return {
        ...t,
        stops: a.stops.map((s) => ({ id: newId(), city: s.city, nights: Math.max(1, Math.min(30, Math.round(s.nights))), ...(s.stopover ? { stopover: true } : {}) })),
        legModes: {},
        picks: {},
      };
    case "tripType":
      return { ...t, tripType: a.value, returnHome: a.value !== "oneway" };
    case "stopover":
      return { ...t, stops: t.stops.map((s) => (s.id === a.id ? { ...s, stopover: a.value || undefined } : s)) };
    case "travellers":
      return { ...t, travellers: a.names.map((n) => n.trim()).filter(Boolean).slice(0, 9) };
    case "hotel": {
      const hotels = { ...(t.hotels ?? {}) };
      if (a.hotel) hotels[a.city] = a.hotel;
      else delete hotels[a.city];
      return { ...t, hotels };
    }
    case "confirmation": {
      const confirmations = { ...(t.confirmations ?? {}) };
      if (a.value.trim()) confirmations[a.key] = a.value.trim().slice(0, 60);
      else delete confirmations[a.key];
      return { ...t, confirmations };
    }
    case "dayNote": {
      const dayNotes = { ...(t.dayNotes ?? {}) };
      if (a.text.trim()) dayNotes[a.date] = a.text.slice(0, 2000);
      else delete dayNotes[a.date];
      return { ...t, dayNotes };
    }
    case "addCost": {
      const amount = Math.max(0, Math.round(a.cost.amount * 100) / 100);
      const cost: TripCost = { ...a.cost, id: a.cost.id ?? newId(), label: a.cost.label.trim().slice(0, 120) || "Cost", amount };
      return { ...t, costs: [...(t.costs ?? []).filter((c) => c.id !== cost.id), cost] };
    }
    case "removeCost":
      return { ...t, costs: (t.costs ?? []).filter((c) => c.id !== a.id) };
    case "planResponse":
      return t.plan ? { ...t, plan: { ...t.plan, response: a.response } } : t;
  }
}
