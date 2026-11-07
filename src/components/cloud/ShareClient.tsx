"use client";

import dynamic from "next/dynamic";

/** The share token lives in the address after "#", so it never reaches the server; the page renders in the browser. */
export const ShareClient = dynamic(() => import("./ShareView").then((m) => m.ShareView), {
  ssr: false,
  loading: () => <div aria-busy="true" style={{ minHeight: "100dvh" }} />,
});
