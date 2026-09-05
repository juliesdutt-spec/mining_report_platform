import React from "react";
import {
  BarChart3,
  Cloud,
  Database,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LucideIcon,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { NavigationTab, OrganisationFilter } from "@/types";
import { organisationsIn, useCorpus } from "@/lib/corpus";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  selectedOrganisation: OrganisationFilter;
  onSelectOrganisation: (org: OrganisationFilter) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: LucideIcon;
  count?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "ask", label: "Ask DataForge", icon: Sparkles },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "topics", label: "Topic Intelligence", icon: Cloud },
  { id: "reports", label: "Report Studio", icon: FileSpreadsheet },
  { id: "explorer", label: "Data Explorer", icon: Database },
  { id: "validation", label: "Validation", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  currentTab,
  onSelectTab,
  selectedOrganisation,
  onSelectOrganisation,
  isCollapsed,
}: SidebarProps) {
  // Organisations come from the documents themselves, so the filter lists
  // exactly what has been indexed — never a roster of bodies with no documents.
  const { documents, isLoading } = useCorpus();
  const organisations = organisationsIn(documents);

  return (
    <aside
      className={cn(
        "z-30 flex flex-col border-r border-border bg-card transition-[width] duration-200",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Organisation identity */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-sm font-semibold text-primary-foreground">
          DF
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              DataForge
            </div>
            <div className="truncate text-[11px] text-muted-foreground">CMPDI · Coal India</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {!isCollapsed && (
          <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Platform
          </div>
        )}

        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            const button = (
              <button
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isCollapsed && "justify-center px-0",
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    {item.count !== undefined && (
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {item.count}
                      </span>
                    )}
                  </>
                )}
              </button>
            );

            return (
              <li key={item.id}>
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </li>
            );
          })}
        </ul>

        {!isCollapsed && (
          <>
            <Separator className="my-4" />
            <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Organisation
            </div>
            {isLoading ? (
              <div className="px-2.5 py-1.5 text-xs text-muted-foreground">Loading…</div>
            ) : organisations.length === 0 ? (
              <p className="px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                No organisation was identified in the indexed documents.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {[{ name: "ALL", count: documents.length }, ...organisations].map((org) => {
                  const isSelected = selectedOrganisation === org.name;
                  return (
                    <li key={org.name}>
                      <button
                        onClick={() => onSelectOrganisation(org.name)}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex w-full items-baseline gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected
                            ? "bg-accent font-medium text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <span className="flex-1 truncate">
                          {org.name === "ALL" ? "All organisations" : org.name}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {org.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </nav>

      {/* Operator identity */}
      <div className="border-t border-border p-3">
        <div className={cn("flex items-center gap-2.5", isCollapsed && "justify-center")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
            AD
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-foreground">Auditor desk</div>
              <div className="truncate text-[11px] text-muted-foreground">cmpdi.officer@cil.gov.in</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
