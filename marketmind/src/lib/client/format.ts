export function fmtPrice(x: number | null | undefined, digits?: number): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const d = digits ?? (Math.abs(x) >= 1 ? 2 : 4);
  return x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPct(x: number | null | undefined, digits = 2): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
}

export function fmtMoney(x: number, digits = 2): string {
  const sign = x < 0 ? "-" : "";
  return `${sign}$${Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function fmtCompact(x: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(x);
}

export function arrow(x: number): string {
  return x > 0 ? "▲" : x < 0 ? "▼" : "■";
}

export function dirClass(x: number | null | undefined): string {
  if (!x) return "soft";
  return x > 0 ? "up" : "down";
}

export function timeAgo(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function symbolHref(symbol: string): string {
  return `/symbol/${encodeURIComponent(symbol)}`;
}

export function displaySymbol(symbol: string): string {
  return symbol.replace(/^\^/, "");
}
