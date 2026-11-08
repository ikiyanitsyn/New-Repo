import type { Metadata } from "next";
import { StyleBoardClient } from "@/components/styles/StyleBoardClient";

export const metadata: Metadata = {
  title: "Style board · Intercontinental Nomad",
  description: "Compare colour palettes, heading fonts and motion, and apply one to the whole app.",
};

export default function StylesPage() {
  return <StyleBoardClient />;
}
