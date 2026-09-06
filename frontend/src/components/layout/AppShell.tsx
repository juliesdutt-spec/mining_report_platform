import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { EvidenceSheet } from "@/components/shared/EvidenceSheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationTab, OrganisationFilter, EvidenceSnippet } from "@/types";
import { checkBackendHealth } from "@/services/api";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";

interface AppShellProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab, param?: string) => void;
  selectedOrganisation: OrganisationFilter;
  onSelectOrganisation: (sub: OrganisationFilter) => void;
  activeEvidence: EvidenceSnippet | null;
  onCloseEvidence: () => void;
  onQuickUpload: () => void;
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
  children,
}: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
      if (e.key === "Escape") setIsMobileNavOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        {/* Dimmed backdrop for the drawer. Tapping the page is the gesture
            people try first, so it has to close the drawer. */}
        {isMobileNavOpen && (
          <div
            className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

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
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            currentTab={currentTab}
            isCollapsed={isCollapsed}
            onToggleSidebar={toggleSidebar}
            isMobileNavOpen={isMobileNavOpen}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            selectedOrganisation={selectedOrganisation}
            onQuickUpload={onQuickUpload}
            backendStatus={backendStatus}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
          </main>
        </div>

        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
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
