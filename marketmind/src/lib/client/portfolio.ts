"use client";
import { useSyncExternalStore } from "react";
import type { DebateVerdict, TradeIdea } from "../types";

export interface Position {
  symbol: string;
  name: string;
  qty: number;
  avgCost: number;
  /** When the latest buy happened; day P&L for a position bought today starts from its cost. */
  lastBuyAt?: number;
}

export interface Fill {
  id: string;
  t: number;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  note?: string;
}

export interface JournalEntry {
  id: string;
  t: number;
  trade: TradeIdea;
  name: string;
  priceAtDebate: number;
  verdict: DebateVerdict;
  mode: "ai" | "offline";
}

export interface PortfolioState {
  startingCash: number;
  cash: number;
  positions: Record<string, Position>;
  fills: Fill[];
  journal: JournalEntry[];
  watchlist: string[];
}

const KEY = "mm:portfolio:v1";
const START = 100_000;

function fresh(): PortfolioState {
  return { startingCash: START, cash: START, positions: {}, fills: [], journal: [], watchlist: ["^GSPC", "QQQ", "NVDA", "GLD", "XLE"] };
}

let state: PortfolioState | null = null;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT = fresh();

function load(): PortfolioState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...fresh(), ...(JSON.parse(raw) as PortfolioState) } : fresh();
  } catch {
    state = fresh();
  }
  return state;
}

function save(next: PortfolioState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: keep the in-memory copy
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePortfolio(): PortfolioState {
  return useSyncExternalStore(subscribe, load, () => SERVER_SNAPSHOT);
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function placeOrder(o: { symbol: string; name: string; side: "buy" | "sell"; qty: number; price: number; note?: string }): string | null {
  const s = load();
  if (!(o.qty > 0) || !(o.price > 0)) return "Enter a quantity above zero.";
  const cost = o.qty * o.price;
  const pos = s.positions[o.symbol];
  let cash = s.cash;
  let positions: Record<string, Position>;
  if (o.side === "buy") {
    if (cost > s.cash + 1e-6) return `Not enough cash: this order needs $${cost.toFixed(2)} and you have $${s.cash.toFixed(2)}.`;
    const qty = (pos?.qty ?? 0) + o.qty;
    positions = { ...s.positions, [o.symbol]: { symbol: o.symbol, name: o.name, qty, avgCost: ((pos?.qty ?? 0) * (pos?.avgCost ?? 0) + cost) / qty, lastBuyAt: Date.now() } };
    cash -= cost;
  } else {
    if (!pos || pos.qty < o.qty - 1e-9) return `You only hold ${pos?.qty ?? 0} ${o.symbol}. The paper account doesn't allow short selling.`;
    const qty = pos.qty - o.qty;
    positions = Object.fromEntries(Object.entries(s.positions).filter(([k]) => k !== o.symbol || qty > 1e-9));
    if (qty > 1e-9) positions[o.symbol] = { ...pos, qty };
    cash += cost;
  }
  const fill: Fill = { id: uid(), t: Date.now(), symbol: o.symbol, side: o.side, qty: o.qty, price: o.price, note: o.note };
  save({ ...s, cash, positions, fills: [fill, ...s.fills].slice(0, 500) });
  return null;
}

export function addJournal(e: Omit<JournalEntry, "id" | "t">) {
  const s = load();
  save({ ...s, journal: [{ ...e, id: uid(), t: Date.now() }, ...s.journal].slice(0, 200) });
}

export function removeJournal(id: string) {
  const s = load();
  save({ ...s, journal: s.journal.filter((j) => j.id !== id) });
}

export function toggleWatch(symbol: string) {
  const s = load();
  const has = s.watchlist.includes(symbol);
  save({ ...s, watchlist: has ? s.watchlist.filter((x) => x !== symbol) : [...s.watchlist, symbol] });
}

export function resetPortfolio() {
  const s = load();
  save({ ...fresh(), journal: s.journal, watchlist: s.watchlist });
}
