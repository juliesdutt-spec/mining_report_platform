import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { EvidenceSheet } from "@/components/shared/EvidenceSheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationTab, OrganisationFilter, EvidenceSnippet } from "@/types";
import { checkBackendHealth } from "@/services/api";

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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          selectedOrganisation={selectedOrganisation}
          onSelectOrganisation={onSelectOrganisation}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            currentTab={currentTab}
            isCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            selectedOrganisation={selectedOrganisation}
            onQuickUpload={onQuickUpload}
            backendStatus={backendStatus}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-8">{children}</div>
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
