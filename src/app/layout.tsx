import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/bodoni-moda/opsz-italic.css";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./palettes.css";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "Nomad", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
  title: "Intercontinental Nomad",
  description: "Plan multi-city trips: flights in and out, trains and transfers between, and everything to see and do in one itinerary.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffdf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b2938" },
  ],
};

// Applies the saved theme before first paint so there is no flash.
const themeScript = `(function(){try{var d=document.documentElement,t=localStorage.getItem("in:theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var p=localStorage.getItem("in:palette");if(p==="lagoon"||p==="sunset")d.setAttribute("data-palette",p);else if(p)localStorage.removeItem("in:palette");var f=localStorage.getItem("in:font");if(f==="fraunces"||f==="manrope")d.setAttribute("data-font",f)}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
