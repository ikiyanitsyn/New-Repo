"use client";

/** Palette and heading font choices from the style board, applied to the whole app. */
export type Palette = "classic" | "evergreen" | "brassnight" | "garden";
export type HeadingFont = "bodoni" | "fraunces" | "manrope";

export const PALETTES: { id: Palette; name: string; blurb: string }[] = [
  { id: "classic", name: "Original", blurb: "Midnight ink, porcelain and brass. The look you have today." },
  { id: "evergreen", name: "Evergreen", blurb: "Forest green and warm cream with brass. Earthy, calm and inviting." },
  { id: "brassnight", name: "Brass Night", blurb: "Near-black green with bright brass and jade. Cinematic after dark, crisp by day." },
  { id: "garden", name: "Garden Party", blurb: "Ivory, emerald and marigold with rounder shapes. The friendliest and most colourful." },
];

export const FONTS: { id: HeadingFont; name: string; blurb: string }[] = [
  { id: "bodoni", name: "Bodoni Moda", blurb: "Elegant high-contrast serif (current)." },
  { id: "fraunces", name: "Fraunces", blurb: "Soft, warm modern serif. Luxury that feels friendly." },
  { id: "manrope", name: "Manrope", blurb: "Clean modern sans. App-like and confident." },
];

export function currentPrefs(): { palette: Palette; font: HeadingFont } {
  const d = document.documentElement;
  return {
    palette: (d.getAttribute("data-palette") as Palette) || "classic",
    font: (d.getAttribute("data-font") as HeadingFont) || "bodoni",
  };
}

export function applyPrefs(palette: Palette, font: HeadingFont) {
  const d = document.documentElement;
  if (palette === "classic") d.removeAttribute("data-palette");
  else d.setAttribute("data-palette", palette);
  if (font === "bodoni") d.removeAttribute("data-font");
  else d.setAttribute("data-font", font);
  try {
    if (palette === "classic") localStorage.removeItem("in:palette");
    else localStorage.setItem("in:palette", palette);
    if (font === "bodoni") localStorage.removeItem("in:font");
    else localStorage.setItem("in:font", font);
  } catch {}
  // The globe and maps recolour themselves on this event.
  window.dispatchEvent(new Event("in:themechange"));
}
