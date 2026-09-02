import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { EvidenceDrawer } from "@/components/shared/EvidenceDrawer";
import { NavigationTab, Subsidiary, EvidenceSnippet } from "@/types";
import { checkBackendHealth } from "@/services/api";

interface AppShellProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  selectedSubsidiary: Subsidiary | "ALL";
  onSelectSubsidiary: (sub: Subsidiary | "ALL") => void;
  activeEvidence: EvidenceSnippet | null;
  onCloseEvidence: () => void;
  onQuickUpload: () => void;
  children: React.ReactNode;
}

export function AppShell({
  currentTab,
  onSelectTab,
  selectedSubsidiary,
  onSelectSubsidiary,
  activeEvidence,
  onCloseEvidence,
  onQuickUpload,
  children,
}: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState({
    isOnline: false,
    statusText: "Checking...",
  });

  useEffect(() => {
    checkBackendHealth().then(setBackendStatus);
    const interval = setInterval(() => {
      checkBackendHealth().then(setBackendStatus);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut listener (⌘K and ⌘B)
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
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Persistent Left Sidebar (Ref: Screenshot 3) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        selectedSubsidiary={selectedSubsidiary}
        onSelectSubsidiary={onSelectSubsidiary}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Contextual Header */}
        <Header
          currentTab={currentTab}
          isCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          selectedSubsidiary={selectedSubsidiary}
          onQuickUpload={onQuickUpload}
          backendStatus={backendStatus}
        />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 p-4 sm:p-6 lg:p-7">
          <div className="mx-auto max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={onSelectTab}
      />

      {/* Traceable Evidence Flyout Inspector */}
      <EvidenceDrawer
        evidence={activeEvidence}
        isOpen={Boolean(activeEvidence)}
        onClose={onCloseEvidence}
      />
    </div>
  );
}
