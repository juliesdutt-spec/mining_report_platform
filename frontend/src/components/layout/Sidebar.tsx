import React from "react";
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  BarChart3,
  Cloud,
  FileSpreadsheet,
  Database,
  ShieldCheck,
  Settings,
  ChevronRight,
  HardHat,
  ChevronsUpDown,
  Building2,
  HelpCircle,
  LucideIcon
} from "lucide-react";
import { NavigationTab, Subsidiary } from "@/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  selectedSubsidiary: Subsidiary | "ALL";
  onSelectSubsidiary: (sub: Subsidiary | "ALL") => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  selectedSubsidiary,
  onSelectSubsidiary,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const mainNavItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "Documents", icon: FileText, badge: "5" },
    { id: "ask", label: "Ask DataForge", icon: Sparkles, badge: "AI" },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "topics", label: "Topic Intelligence", icon: Cloud },
    { id: "reports", label: "Report Studio", icon: FileSpreadsheet },
    { id: "explorer", label: "Data Explorer", icon: Database },
    { id: "validation", label: "Validation", icon: ShieldCheck, badge: "3" },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const subsidiaries: { id: Subsidiary | "ALL"; label: string }[] = [
    { id: "ALL", label: "All Subsidiaries" },
    { id: "SECL", label: "SECL (Korba/Bilaspur)" },
    { id: "BCCL", label: "BCCL (Jharia/Dhanbad)" },
    { id: "CMPDI", label: "CMPDI (Exploration)" },
    { id: "NCL", label: "NCL (Singrauli)" },
    { id: "MCL", label: "MCL (Talcher/Ib)" },
    { id: "CCL", label: "CCL (Ranchi)" },
    { id: "ECL", label: "ECL (Raniganj)" },
  ];

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-zinc-800/80 bg-zinc-950 transition-all duration-300 select-none z-30",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Enterprise Organization Switcher (Ref: Screenshot 3) */}
      <div className="flex h-14 items-center border-b border-zinc-800/80 px-3">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100">
              <HardHat className="h-4 w-4 text-amber-400" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col text-left overflow-hidden">
                <span className="truncate text-xs font-semibold tracking-tight text-zinc-100">
                  DataForge Intelligence
                </span>
                <span className="truncate text-[10px] text-zinc-500 font-mono">
                  CMPDI / CIL • SIH26023
                </span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
          )}
        </div>
      </div>

      {/* Main Navigation Section */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {/* Platform category */}
        <div>
          {!isCollapsed && (
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Platform
            </div>
          )}
          <nav className="space-y-0.5">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-zinc-800/90 text-zinc-100 font-medium"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive ? "text-zinc-100" : "text-zinc-400"
                    )}
                  />
                  {!isCollapsed && (
                    <>
                      <span className="truncate text-left flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 text-[10px] font-mono",
                            item.badge === "AI"
                              ? "bg-sky-950/80 text-sky-400 border border-sky-800/50"
                              : "bg-zinc-800 text-zinc-400"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Subsidiaries filter category */}
        {!isCollapsed && (
          <div>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
              <span>Subsidiaries</span>
              <Building2 className="h-3 w-3 text-zinc-600" />
            </div>
            <div className="space-y-0.5 mt-1">
              {subsidiaries.map((sub) => {
                const isSelected = selectedSubsidiary === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => onSelectSubsidiary(sub.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2.5 py-1 text-[11px] font-mono transition-colors",
                      isSelected
                        ? "bg-zinc-800/60 text-emerald-400 font-medium border border-zinc-700/60"
                        : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                    )}
                  >
                    <span className="truncate">{sub.label}</span>
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* User / Team Footer (Ref: Screenshot 3) */}
      <div className="border-t border-zinc-800/80 p-2">
        <div className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-zinc-900/60 transition-colors">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300">
            DF
          </div>
          {!isCollapsed && (
            <div className="flex flex-col text-left overflow-hidden">
              <span className="truncate text-xs font-medium text-zinc-200">
                Auditor Desk
              </span>
              <span className="truncate text-[10px] text-zinc-500 font-mono">
                cmpdi.officer@cil.gov.in
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
