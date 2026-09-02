import React from "react";
import {
  PanelLeft,
  Search,
  Bell,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Plus,
  Sparkles
} from "lucide-react";
import { NavigationTab, Subsidiary } from "@/types";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  currentTab: NavigationTab;
  isCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
  selectedSubsidiary: Subsidiary | "ALL";
  onQuickUpload: () => void;
  backendStatus: { isOnline: boolean; statusText: string };
}

export function Header({
  currentTab,
  isCollapsed,
  onToggleSidebar,
  onOpenCommandPalette,
  selectedSubsidiary,
  onQuickUpload,
  backendStatus,
}: HeaderProps) {
  const tabTitles: Record<NavigationTab, { title: string; subtitle: string }> = {
    dashboard: { title: "Executive Dashboard", subtitle: "Operational mining overview & metrics" },
    documents: { title: "Document Intelligence", subtitle: "Archival PDF ingestion & entity extraction" },
    ask: { title: "Ask DataForge", subtitle: "Grounded research workspace backed by indexed records" },
    analytics: { title: "Production Analytics", subtitle: "Subsidiary trends, stripping ratios & reserves" },
    topics: { title: "Topic Intelligence", subtitle: "Word cloud, semantic tags & geological themes" },
    reports: { title: "Report Studio", subtitle: "Automated report synthesis & statutory compliance" },
    explorer: { title: "Data Explorer", subtitle: "Granular structured tabular records" },
    validation: { title: "Validation & Traceability", subtitle: "Audit discrepancies, confidence & source verification" },
    settings: { title: "System Settings", subtitle: "Backend configuration, models & OCR parameters" },
  };

  const currentInfo = tabTitles[currentTab] || { title: "DataForge", subtitle: "" };

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 backdrop-blur-md">
      {/* Left: Sidebar toggle + Breadcrumbs (Ref: Screenshot 3 & 4) */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
          title="Toggle Sidebar (⌘B)"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>

        {/* Breadcrumb path */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-zinc-500 font-medium">DataForge</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
          <span className="font-semibold text-zinc-200">{currentInfo.title}</span>
          {selectedSubsidiary !== "ALL" && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
              <span className="font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 text-[10px]">
                {selectedSubsidiary}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Search / Command Palette trigger + Status + Action buttons */}
      <div className="flex items-center gap-2.5">
        {/* Command Palette Trigger (Ref: Screenshot 3 "Type to search... ⌘K") */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex h-8 w-56 sm:w-64 items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-500 truncate">Search documents, mines, data...</span>
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-1.5 text-[10px] font-mono text-zinc-400">
            ⌘K
          </kbd>
        </button>

        {/* Live Backend Connection Indicator */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              backendStatus.isOnline ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          <span>{backendStatus.statusText}</span>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 relative">
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
        </Button>

        {/* Quick Create / Ingest Action (Ref: Screenshot 4) */}
        <Button
          variant="default"
          size="sm"
          onClick={onQuickUpload}
          className="h-8 gap-1.5 font-medium shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Upload Document</span>
        </Button>
      </div>
    </header>
  );
}
