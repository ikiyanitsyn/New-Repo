import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "MarketMind",
  description: "Market trends, geopolitical news analysis, speculative outlooks and an AI advisor roundtable for stocks, ETFs and indexes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem("mm:theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-4 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-[1400px] px-4 pb-10 text-xs leading-relaxed muted sm:px-6">
          MarketMind is a research and education tool. Outlooks are speculative model output, not predictions or personal financial advice.
          Advisor personas are AI simulations inspired by public investing philosophies. They are not the real people and are not endorsed by them.
          Paper trading uses virtual money only. Market data may be delayed; sample data is labelled. Always do your own research.
        </footer>
      </body>
    </html>
  );
}
