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
 *
 * A second segment is carried through as an opaque parameter (#/documents/12),
 * which is what lets the command palette open a specific document rather than
 * dropping the user on the list.
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

function parseHash(): { tab: NavigationTab; param: string | null } {
  const raw = window.location.hash.replace(/^#\/?/, "").trim();
  const [head, param] = raw.split("/");
  return {
    tab: (TABS as string[]).includes(head) ? (head as NavigationTab) : DEFAULT_TAB,
    param: param ? decodeURIComponent(param) : null,
  };
}

export function useHashRoute(): [
  NavigationTab,
  (tab: NavigationTab, param?: string) => void,
  string | null
] {
  const [route, setRoute] = useState(parseHash);

  // Back/Forward and manually edited URLs.
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Give a bare URL a canonical hash without adding a history entry.
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", `#/${DEFAULT_TAB}`);
    }
  }, []);

  const navigate = useCallback((next: NavigationTab, param?: string) => {
    const target = param ? `#/${next}/${encodeURIComponent(param)}` : `#/${next}`;
    // Setting the hash pushes a history entry, which is what makes Back work.
    if (window.location.hash !== target) {
      window.location.hash = target;
    }
    setRoute({ tab: next, param: param ?? null });
  }, []);

  return [route.tab, navigate, route.param];
}
