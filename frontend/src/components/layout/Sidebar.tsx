import React, { useRef } from "react";
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
  LogOut,
  Sparkles,
  X,
} from "lucide-react";
import { NavigationTab, OrganisationFilter } from "@/types";
import { organisationsIn, useCorpus } from "@/lib/corpus";
import { cn } from "@/lib/utils";
import { SessionUser } from "@/lib/session";
import { TAB_TITLES } from "@/lib/tabs";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { Wordmark, WordmarkGlyph } from "@/components/brand/Wordmark";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  selectedOrganisation: OrganisationFilter;
  onSelectOrganisation: (org: OrganisationFilter) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Below `md` the sidebar slides over the content instead of docking. */
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  user: SessionUser;
  onSignOut: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: LucideIcon;
  count?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: TAB_TITLES.dashboard, icon: LayoutDashboard },
  { id: "documents", label: TAB_TITLES.documents, icon: FileText },
  { id: "ask", label: TAB_TITLES.ask, icon: Sparkles },
  { id: "analytics", label: TAB_TITLES.analytics, icon: BarChart3 },
  { id: "topics", label: TAB_TITLES.topics, icon: Cloud },
  { id: "reports", label: TAB_TITLES.reports, icon: FileSpreadsheet },
  { id: "explorer", label: TAB_TITLES.explorer, icon: Database },
  { id: "validation", label: TAB_TITLES.validation, icon: ShieldCheck },
  { id: "settings", label: TAB_TITLES.settings, icon: Settings },
];

/** Up to two initials from a display name, falling back to the username. */
function initialsOf(user: SessionUser): string {
  const source = (user.display_name || user.username || "?").trim();
  // Only words that begin with a letter or digit are names. A parenthetical
  // qualifier counted as one, so "Demo (read-only)" drew the avatar as "D(".
  const words = source.split(/\s+/).filter((word) => /^[\p{L}\p{N}]/u.test(word));
  if (words.length >= 2) return words[0][0] + words[1][0];
  if (words.length === 1) return words[0].slice(0, 2);
  return source.slice(0, 2);
}

export function Sidebar({
  currentTab,
  onSelectTab,
  selectedOrganisation,
  onSelectOrganisation,
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
  user,
  onSignOut,
}: SidebarProps) {
  // Organisations come from the documents themselves, so the filter lists
  // exactly what has been indexed — never a roster of bodies with no documents.
  const { documents, isLoading } = useCorpus();
  const organisations = organisationsIn(documents);

  // As a drawer this covers the page, so it has to behave like one: focus
  // moves in when it opens, Tab stays inside it while it is over the content,
  // and closing hands focus back to the control that opened it. Docked from
  // `md` up it is ordinary page furniture and traps nothing.
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(isMobileOpen, drawerRef, onCloseMobile);

  return (
    <aside
      id="app-sidebar"
      ref={drawerRef}
      aria-label="Primary"
      // Only while it is a drawer over the page. A docked sidebar announced as
      // a modal would be a lie about the rest of the screen.
      role={isMobileOpen ? "dialog" : undefined}
      aria-modal={isMobileOpen ? true : undefined}
      className={cn(
        // Docked in the layout from `md` up. Below that it is a drawer over the
        // content: 256px of a 390px phone left roughly 130px for the page,
        // which is why every screen looked crushed rather than narrow.
        "flex w-64 flex-col border-r border-border bg-card",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-200",
        "md:static md:z-30 md:translate-x-0 md:transition-[width]",
        // `invisible` keeps the closed drawer out of the focus order, so Tab
        // does not walk through nine off-screen links.
        isMobileOpen ? "translate-x-0" : "invisible -translate-x-full",
        "md:visible",
        isCollapsed ? "md:w-16" : "md:w-64"
      )}
    >
      {/* Organisation identity */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-3">
        {isCollapsed ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border">
            <WordmarkGlyph />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <Wordmark size="sm" />
            <div className="truncate text-[11px] text-muted-foreground">CMPDI · Coal India</div>
          </div>
        )}

        {/* The backdrop and Escape also close the drawer, but neither is
            discoverable by looking at it. */}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="-mr-1 ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
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

      {/* Who is signed in. This was a fixed name and address before accounts
          existed - it now names the actual session, and can end it. */}
      <div className="border-t border-border p-3">
        <div className={cn("flex items-center gap-2.5", isCollapsed && "justify-center")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase text-foreground">
            {initialsOf(user)}
          </div>
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-foreground">
                  {user.display_name || user.username}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {user.readonly ? "Read-only access" : "Full access"}
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
