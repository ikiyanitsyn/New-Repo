"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useJson } from "@/lib/client/hooks";
import { displaySymbol, symbolHref } from "@/lib/client/format";

const LINKS = [
  ["/", "Dashboard"],
  ["/markets", "Markets"],
  ["/news", "News & Geopolitics"],
  ["/debate", "Advisor Roundtable"],
  ["/portfolio", "Paper Portfolio"],
] as const;

interface Status {
  ai: boolean;
  model: string | null;
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the theme the inline script applied
    setTheme(t === "light" || t === "dark" ? t : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  function flip() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mm:theme", next);
    } catch {}
    setTheme(next);
  }
  return (
    <button className="btn px-2.5" onClick={flip} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle theme">
      <span aria-hidden>{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}

function Search() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { data } = useJson<{ results: { symbol: string; name: string; cls: string }[] }>(q.trim() ? `/api/search?q=${encodeURIComponent(q.trim())}` : null);
  const results = q.trim() ? (data?.results ?? []) : [];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function go(symbol: string) {
    setOpen(false);
    setQ("");
    router.push(symbolHref(symbol));
  }

  return (
    <div ref={ref} className="relative w-full sm:w-64">
      <input
        className="input py-1.5"
        placeholder="Search ticker or company…"
        value={q}
        aria-label="Search for a stock, ETF or index"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && results[active]) go(results[active].symbol);
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <ul className="card absolute right-0 z-30 mt-1 max-h-80 w-full overflow-auto py-1 text-sm sm:w-80">
          {results.map((r, i) => (
            <li key={r.symbol}>
              <button
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                style={{ background: i === active ? "var(--surface-2)" : undefined }}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.symbol)}
              >
                <span>
                  <span className="font-semibold">{displaySymbol(r.symbol)}</span> <span className="soft">{r.name}</span>
                </span>
                <span className="chip">{r.cls === "etf" ? "ETF" : r.cls === "index" ? "Index" : "Stock"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Nav() {
  const path = usePathname();
  const { data: status } = useJson<Status>("/api/status");
  const [menu, setMenu] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b backdrop-blur" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--page) 85%, transparent)" }}>
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
            <rect width="26" height="26" rx="7" fill="var(--accent)" />
            <path d="M5 18 L10 12 L14 15 L21 7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="21" cy="7" r="2" fill="#fff" />
          </svg>
          MarketMind
        </Link>
        <button className="btn ml-auto px-2.5 lg:hidden" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu">
          ☰
        </button>
        <nav className={`${menu ? "flex" : "hidden"} w-full flex-col gap-1 lg:flex lg:w-auto lg:flex-row lg:gap-1`}>
          {LINKS.map(([href, label]) => {
            const on = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenu(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{ background: on ? "var(--accent-soft)" : undefined, color: on ? "var(--accent)" : "var(--ink-2)" }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className={`${menu ? "flex" : "hidden"} w-full items-center gap-2 sm:flex sm:w-auto lg:ml-auto`}>
          <Search />
          {status && (
            <span className={`chip ${status.ai ? "chip-accent" : ""}`} title={status.ai ? `Claude connected (${status.model})` : "Add ANTHROPIC_API_KEY to .env.local to enable Claude"}>
              <span aria-hidden>{status.ai ? "✦" : "◇"}</span>
              {status.ai ? "Claude AI on" : "Built-in engine"}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
