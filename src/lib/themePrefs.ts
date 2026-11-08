"use client";

/** Palette and heading font choices from the style board, applied to the whole app. */
export type Palette = "classic" | "lagoon" | "sunset";
export type HeadingFont = "bodoni" | "fraunces" | "manrope";

export const PALETTES: { id: Palette; name: string; blurb: string }[] = [
  { id: "classic", name: "Riviera", blurb: "Whitewashed sand, deep-sea navy, terracotta coral and Mediterranean turquoise, with lemon highlights. The new default." },
  { id: "lagoon", name: "Lagoon", blurb: "Turquoise water and island blue on soft white. Breezy and beachy." },
  { id: "sunset", name: "Amalfi Sunset", blurb: "Bougainvillea pink and sea blue on warm peach light. Romantic evenings on the coast." },
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
