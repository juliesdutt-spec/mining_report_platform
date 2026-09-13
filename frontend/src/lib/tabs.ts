import { NavigationTab } from "@/types";

/**
 * The name of each screen, in one place.
 *
 * The sidebar, the header breadcrumb, the browser tab title and the screen
 * reader announcement all name the same nine screens; three separate copies
 * of the list drifted apart the moment one of them was renamed.
 */
export const TAB_TITLES: Record<NavigationTab, string> = {
  dashboard: "Dashboard",
  documents: "Documents",
  ask: "Ask DataForge",
  analytics: "Analytics",
  topics: "Topic Intelligence",
  reports: "Report Studio",
  explorer: "Data Explorer",
  validation: "Validation",
  settings: "Settings",
};

/** Suffix kept on every browser tab so a bookmark still says what the app is. */
export const APP_NAME = "DataForge";

export function documentTitleFor(tab: NavigationTab): string {
  return `${TAB_TITLES[tab]} · ${APP_NAME}`;
}
