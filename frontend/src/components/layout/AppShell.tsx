import React, { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { EvidenceSheet } from "@/components/shared/EvidenceSheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationTab, OrganisationFilter, EvidenceSnippet } from "@/types";
import { checkBackendHealth } from "@/services/api";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { SessionUser } from "@/lib/session";
import { TAB_TITLES, documentTitleFor } from "@/lib/tabs";

interface AppShellProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab, param?: string) => void;
  selectedOrganisation: OrganisationFilter;
  onSelectOrganisation: (sub: OrganisationFilter) => void;
  activeEvidence: EvidenceSnippet | null;
  onCloseEvidence: () => void;
  onQuickUpload: () => void;
  user: SessionUser;
  onSignOut: () => void;
  children: React.ReactNode;
}

export function AppShell({
  currentTab,
  onSelectTab,
  selectedOrganisation,
  onSelectOrganisation,
  activeEvidence,
  onCloseEvidence,
  onQuickUpload,
  user,
  onSignOut,
  children,
}: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  // Radix restores focus to whatever opened a dialog, but this one is driven
  // by state rather than a trigger element, so there was nothing to restore
  // to: closing it dropped focus onto <body> and the next Tab started again
  // from the top of the page. Remember where the caller was standing.
  const focusBeforePalette = useRef<HTMLElement | null>(null);

  const openCommandPalette = useCallback(() => {
    focusBeforePalette.current = document.activeElement as HTMLElement | null;
    setIsCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
    // After the dialog has released focus, not before.
    const previous = focusBeforePalette.current;
    window.setTimeout(() => {
      if (previous && document.contains(previous)) previous.focus();
      else document.getElementById("main-content")?.focus();
    }, 0);
  }, []);

  // The same control means two things. Docked, it collapses the rail to icons;
  // as a drawer, it slides the whole sidebar in. Collapsing a drawer would
  // leave a 64px overlay covering the page, so collapse is desktop-only.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isCollapsed = isDesktop && isSidebarCollapsed;

  const toggleSidebar = () => {
    if (isDesktop) setIsSidebarCollapsed((prev) => !prev);
    else setIsMobileNavOpen((prev) => !prev);
  };

  // Widening the window while the drawer is open would otherwise dock a
  // sidebar with a backdrop still over the page.
  useEffect(() => {
    if (isDesktop) setIsMobileNavOpen(false);
  }, [isDesktop]);

  // Arriving on a new screen.
  //
  // <main> is the scroll container and React keeps that same node across every
  // route change, so its scroll offset survived the navigation: leaving a
  // scrolled Dashboard opened Documents 829px down, past its heading and its
  // upload area, in the middle of a table. Nothing told the browser tab or a
  // screen reader that the screen had changed either — every route shared one
  // title, so nine bookmarks and nine history entries all read the same.
  useEffect(() => {
    document.getElementById("main-content")?.scrollTo({ top: 0 });
    document.title = documentTitleFor(currentTab);
  }, [currentTab]);
  const [backendStatus, setBackendStatus] = useState({
    isOnline: false,
    statusText: "Checking…",
  });

  useEffect(() => {
    checkBackendHealth().then(setBackendStatus);
    const interval = setInterval(() => {
      checkBackendHealth().then(setBackendStatus);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // ⌘K opens the palette, ⌘B collapses the sidebar.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isCommandPaletteOpen) closeCommandPalette();
        else openCommandPalette();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
      if (e.key === "Escape") setIsMobileNavOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // isCommandPaletteOpen is read inside the handler, so an empty dependency
    // list would capture it as false forever and ⌘K could open the palette
    // but never toggle it shut. The two callbacks are stable.
  }, [isCommandPaletteOpen, openCommandPalette, closeCommandPalette]);

  return (
    <TooltipProvider delayDuration={200}>
      <div id="app-shell" className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        {/* Dimmed backdrop for the drawer. Tapping the page is the gesture
            people try first, so it has to close the drawer. */}
        {isMobileNavOpen && (
          <div
            className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Nine navigation items and an organisation filter sat between the
            top of every page and its content: sixteen presses of Tab before a
            keyboard user reached what they came for, on every navigation.
            Off-screen until focused, so it costs sighted users nothing. */}
        <a
          href="#main-content"
          onClick={(event) => {
            // The shell is a hash router, so a bare #main-content href would
            // be read as a route and navigate away from the page.
            event.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
          className="sr-only z-[60] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>

        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            // A drawer that stays open after navigation hides the page it
            // just moved to.
            setIsMobileNavOpen(false);
            onSelectTab(tab);
          }}
          selectedOrganisation={selectedOrganisation}
          onSelectOrganisation={onSelectOrganisation}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleSidebar}
          isMobileOpen={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
          user={user}
          onSignOut={onSignOut}
        />

        <div id="app-content" className="flex flex-1 flex-col overflow-hidden">
          <Header
            currentTab={currentTab}
            isCollapsed={isCollapsed}
            onToggleSidebar={toggleSidebar}
            isMobileNavOpen={isMobileNavOpen}
            onOpenCommandPalette={openCommandPalette}
            selectedOrganisation={selectedOrganisation}
            onQuickUpload={onQuickUpload}
            backendStatus={backendStatus}
          />

          {/* A hash change swaps the whole screen without a page load, which
              a screen reader has no way to notice. The region is mounted for
              the life of the shell so that changing its text is what gets
              announced. */}
          <div role="status" aria-live="polite" className="sr-only">
            {TAB_TITLES[currentTab]}
          </div>

          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
            <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {/* On paper the sidebar and the header are gone, and with them
                  every clue about which screen this is, whose documents it
                  covers and when it was taken. A sheet of production figures
                  with none of that on it is not a record of anything. */}
              <div className="mb-6 hidden border-b border-border pb-3 print:block">
                <div className="text-sm font-semibold text-foreground">
                  DataForge · {TAB_TITLES[currentTab]}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  CMPDI · Coal India · Scope:{" "}
                  {selectedOrganisation === "ALL" ? "All organisations" : selectedOrganisation} ·
                  Printed {new Date().toLocaleString("en-IN")}
                </div>
              </div>
              {children}
            </div>
          </main>
        </div>

        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={closeCommandPalette}
          onSelectTab={onSelectTab}
        />

        <EvidenceSheet
          evidence={activeEvidence}
          isOpen={Boolean(activeEvidence)}
          onClose={onCloseEvidence}
        />
      </div>
    </TooltipProvider>
  );
}
