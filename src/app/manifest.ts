import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Intercontinental Nomad",
    short_name: "Nomad",
    description: "Plan multi-city trips: flights in and out, trains between, stays and sights, all in one itinerary.",
    start_url: "/",
    display: "standalone",
    background_color: "#111720",
    theme_color: "#111720",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
