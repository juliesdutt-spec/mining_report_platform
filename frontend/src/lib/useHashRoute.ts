import { useCallback, useEffect, useState } from "react";
import { NavigationTab } from "@/types";

/**
 * Minimal hash-based routing for the existing tab navigation.
 *
 * The app is a single-screen SPA whose "pages" are already a NavigationTab
 * union, so a full router would be a migration rather than an improvement.
 * Reflecting the tab in `location.hash` gives working Back/Forward buttons,
 * deep links (#/documents) and refresh-safe navigation with no new dependency
 * and no change to how pages are rendered.
 */
const TABS: NavigationTab[] = [
  "dashboard",
  "documents",
  "ask",
  "analytics",
  "topics",
  "reports",
  "explorer",
  "validation",
  "settings",
];

const DEFAULT_TAB: NavigationTab = "dashboard";

function tabFromHash(): NavigationTab {
  const raw = window.location.hash.replace(/^#\/?/, "").trim();
  return (TABS as string[]).includes(raw) ? (raw as NavigationTab) : DEFAULT_TAB;
}

export function useHashRoute(): [NavigationTab, (tab: NavigationTab) => void] {
  const [tab, setTab] = useState<NavigationTab>(tabFromHash);

  // Back/Forward and manually edited URLs.
  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Give a bare URL a canonical hash without adding a history entry.
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", `#/${DEFAULT_TAB}`);
    }
  }, []);

  const navigate = useCallback((next: NavigationTab) => {
    // Setting the hash pushes a history entry, which is what makes Back work.
    if (tabFromHash() !== next) {
      window.location.hash = `#/${next}`;
    }
    setTab(next);
  }, []);

  return [tab, navigate];
}
