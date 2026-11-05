"use client";

import dynamic from "next/dynamic";
import { styles } from "./styles";

/**
 * The itinerary is built from the trip saved in this browser, so it renders
 * on the client only. The server sends this quiet shell first.
 */
export const ItineraryClient = dynamic(() => import("./Itinerary").then((m) => m.Itinerary), {
  ssr: false,
  loading: () => <div className={styles.root} aria-busy="true" />,
});
