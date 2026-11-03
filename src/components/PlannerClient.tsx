"use client";

import dynamic from "next/dynamic";

/**
 * The planner reads the trip and theme saved on this device, so it renders
 * in the browser only. The server sends this quiet shell first.
 */
export const PlannerClient = dynamic(() => import("./Planner").then((m) => m.Planner), {
  ssr: false,
  loading: () => (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">
          Intercontinental <em>Nomad</em>
        </span>
      </header>
      <main className="stage" />
    </div>
  ),
});
