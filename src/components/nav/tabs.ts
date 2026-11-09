/** The five phone tabs and how the address (URL hash) maps onto them. Pure, so it is easy to test. */

export type TabId = "home" | "trip" | "guide" | "concierge" | "account";

export const TAB_ORDER: TabId[] = ["home", "trip", "guide", "concierge", "account"];

export const TAB_LABEL: Record<TabId, string> = {
  home: "Home",
  trip: "Trip",
  guide: "Guide",
  concierge: "Concierge",
  account: "Account",
};

/**
 * Which tab is lit for the current screen.
 * `landingOpen` is true when the planner is showing the opening (search) page, which is also
 * what a bare address means on a first visit.
 */
export function activeTab(hash: string, landingOpen: boolean): TabId {
  if (hash === "#start") return "home";
  if (hash === "#concierge") return "concierge";
  if (hash.startsWith("#explore-")) return "guide";
  if (hash === "#trips" || hash === "#shared" || hash === "#share" || hash === "#account") return "account";
  if (hash === "#trip") return "trip";
  return landingOpen ? "home" : "trip";
}
