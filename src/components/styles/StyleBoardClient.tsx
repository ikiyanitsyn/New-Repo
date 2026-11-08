"use client";

import dynamic from "next/dynamic";

/** The board reads and sets the saved theme, so it renders in the browser. */
export const StyleBoardClient = dynamic(() => import("./StyleBoard").then((m) => m.StyleBoard), {
  ssr: false,
  loading: () => <div aria-busy="true" style={{ minHeight: "100dvh" }} />,
});
