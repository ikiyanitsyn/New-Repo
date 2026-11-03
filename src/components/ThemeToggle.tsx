"use client";

import { useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

type Choice = "system" | "light" | "dark";
const ORDER: Choice[] = ["system", "light", "dark"];
const LABEL: Record<Choice, string> = { system: "Theme: match system", light: "Theme: light", dark: "Theme: dark" };

export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>(() => {
    try {
      const t = localStorage.getItem("in:theme");
      if (t === "light" || t === "dark") return t;
    } catch {}
    return "system";
  });

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    setChoice(next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    try {
      if (next === "system") localStorage.removeItem("in:theme");
      else localStorage.setItem("in:theme", next);
    } catch {}
    window.dispatchEvent(new Event("in:themechange"));
  };

  const Icon = choice === "light" ? SunIcon : choice === "dark" ? MoonIcon : MonitorIcon;
  return (
    <button type="button" className="btn btn-ghost btn-icon" onClick={cycle} aria-label={LABEL[choice]} title={LABEL[choice]}>
      <Icon size={18} />
    </button>
  );
}
