import React from "react";
import { Bell, ChevronRight, PanelLeft, Plus, Search } from "lucide-react";
import { NavigationTab, Subsidiary } from "@/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

interface HeaderProps {
  currentTab: NavigationTab;
  isCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
  selectedSubsidiary: Subsidiary | "ALL";
  onQuickUpload: () => void;
  backendStatus: { isOnline: boolean; statusText: string };
}

const TAB_TITLES: Record<NavigationTab, string> = {
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

export function Header({
  currentTab,
  onToggleSidebar,
  onOpenCommandPalette,
  selectedSubsidiary,
  onQuickUpload,
  backendStatus,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          title="Toggle sidebar (⌘B)"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">DataForge</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <span className="truncate font-medium text-foreground">{TAB_TITLES[currentTab]}</span>
          {selectedSubsidiary !== "ALL" && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <span className="shrink-0 font-mono text-xs font-medium text-primary">
                {selectedSubsidiary}
              </span>
            </>
          )}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden h-8 w-56 items-center justify-between rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Search…</span>
          </span>
          <kbd className="font-mono text-[10px] text-muted-foreground">⌘K</kbd>
        </button>

        <span
          className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"
          title={backendStatus.statusText}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              backendStatus.isOnline ? "bg-success" : "bg-warning"
            }`}
          />
          {backendStatus.statusText}
        </span>

        <Separator orientation="vertical" className="mx-1 hidden h-5 md:block" />

        <ThemeToggle />

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>

        <Button size="sm" onClick={onQuickUpload}>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
      </div>
    </header>
  );
}
