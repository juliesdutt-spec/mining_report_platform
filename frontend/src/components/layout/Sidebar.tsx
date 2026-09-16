import React, { useRef } from "react";
import {
  BarChart3,
  Cloud,
  Check,
  Database,
  Filter,
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
}

interface NavGroup {
  /** Null on the first group: a header above the top item is ceremony. */
  label: string | null;
  items: NavItem[];
}

/**
 * Nine flat rows gave Topic Intelligence the same weight as Validation and
 * left a newcomer — a judge, an officer opening this for the first time — no
 * way to tell what any of them were for. Two groups is enough to say it:
 * what is in the corpus, and what you derive from it.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ id: "dashboard", label: TAB_TITLES.dashboard, icon: LayoutDashboard }],
  },
  {
    label: "Corpus",
    items: [
      { id: "documents", label: TAB_TITLES.documents, icon: FileText },
      { id: "validation", label: TAB_TITLES.validation, icon: ShieldCheck },
    ],
  },
  {
    label: "Analysis",
    items: [
      { id: "ask", label: TAB_TITLES.ask, icon: Sparkles },
      { id: "explorer", label: TAB_TITLES.explorer, icon: Database },
      { id: "analytics", label: TAB_TITLES.analytics, icon: BarChart3 },
      { id: "topics", label: TAB_TITLES.topics, icon: Cloud },
      { id: "reports", label: TAB_TITLES.reports, icon: FileSpreadsheet },
    ],
  },
];

/**
 * Settings is not a ninth destination. It is the utility every application
 * keeps beside the account, and listing it with the eight made the primary
 * navigation one item longer than the work it describes.
 */
const SETTINGS_ITEM: NavItem = { id: "settings", label: TAB_TITLES.settings, icon: Settings };

/**
 * A short badge for an organisation, for the collapsed rail.
 * "Coal India Limited (CIL)" is already carrying its own abbreviation.
 */
function abbreviate(name: string): string {
  if (name === "ALL") return "ALL";
  const parenthesised = /\(([A-Z]{2,5})\)/.exec(name);
  if (parenthesised) return parenthesised[1];
  const initials = name
    .split(/\s+/)
    .filter((word) => /^[\p{Lu}\p{N}]/u.test(word))
    .map((word) => word[0])
    .join("");
  return (initials || name).slice(0, 3).toUpperCase();
}

/** One navigation row. Shared by the grouped list and by Settings below it. */
function NavButton({
  item,
  isActive,
  isCollapsed,
  onSelect,
}: {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  onSelect: (tab: NavigationTab) => void;
}) {
  const Icon = item.icon;
  const button = (
    <button
      onClick={() => onSelect(item.id)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isCollapsed && "justify-center px-0",
        isActive
          ? "bg-primary/10 font-medium text-primary"
          : "text-nav-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {/* A rail reads as "you are here" at a glance, where a tint alone has to
          be compared against the rows around it. */}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      {!isCollapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
    </button>
  );

  return isCollapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  ) : (
    button
  );
}

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

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label ?? "primary"} className={index > 0 ? "mt-4" : undefined}>
            {group.label &&
              (isCollapsed ? (
                // The rail has no room for a word, but the break between
                // groups is the part worth keeping.
                <Separator className="mb-2" />
              ) : (
                <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
              ))}

            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavButton
                    item={item}
                    isActive={currentTab === item.id}
                    isCollapsed={isCollapsed}
                    onSelect={onSelectTab}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/*
          The organisation filter.

          It used to sit directly under the navigation as a second list of
          near-identical rows, and nothing about it said that these ones change
          what every screen shows rather than which screen you are on. It is
          now visibly a control: its own inset panel, a check against the
          active choice, and a line saying what it does.

          It also only appears when there is a choice to make. With a single
          organisation indexed it read "All organisations 2 / Coal India
          Limited (CIL) 2" — the same number twice, and no decision behind it.
        */}
        {organisations.length > 1 &&
          (isCollapsed ? (
            <>
              <Separator className="my-2" />
              <ul className="space-y-1">
                {[{ name: "ALL", count: documents.length }, ...organisations].map((org) => {
                  const label = org.name === "ALL" ? "All organisations" : org.name;
                  const isSelected = selectedOrganisation === org.name;
                  return (
                    <li key={org.name}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onSelectOrganisation(org.name)}
                            aria-pressed={isSelected}
                            aria-label={`Show ${label}, ${org.count} document${org.count === 1 ? "" : "s"}`}
                            className={cn(
                              "mx-auto flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isSelected
                                ? "bg-primary/10 text-primary"
                                : "text-nav-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            {abbreviate(org.name)}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {label} · {org.count}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/40 p-1.5">
              <div className="flex items-center gap-1.5 px-1.5 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Filter className="h-3 w-3 shrink-0" aria-hidden="true" />
                Organisation
              </div>
              <p className="px-1.5 pb-1.5 pt-0.5 text-[11px] leading-snug text-muted-foreground">
                Filters every screen.
              </p>
              <ul className="space-y-px">
                {[{ name: "ALL", count: documents.length }, ...organisations].map((org) => {
                  const label = org.name === "ALL" ? "All organisations" : org.name;
                  const isSelected = selectedOrganisation === org.name;
                  return (
                    <li key={org.name}>
                      <button
                        onClick={() => onSelectOrganisation(org.name)}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected
                            ? "font-medium text-foreground"
                            : "text-nav-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Check
                          aria-hidden="true"
                          className={cn(
                            "h-3 w-3 shrink-0",
                            isSelected ? "text-primary" : "text-transparent"
                          )}
                        />
                        <span className="flex-1 truncate">{label}</span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {org.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

        {!isCollapsed && isLoading && (
          <div className="mt-5 px-2.5 text-xs text-muted-foreground">Loading organisations…</div>
        )}
      </nav>

      {/* Who is signed in. This was a fixed name and address before accounts
          existed - it now names the actual session, and can end it. */}
      <div className="border-t border-border p-2">
        {/* Settings is a utility, not a destination, so it sits with the
            account rather than lengthening the list of work by one. */}
        <div className="pb-2">
          <NavButton
            item={SETTINGS_ITEM}
            isActive={currentTab === SETTINGS_ITEM.id}
            isCollapsed={isCollapsed}
            onSelect={onSelectTab}
          />
        </div>

        <div className={cn("flex items-center gap-2.5 px-0.5", isCollapsed && "justify-center px-0")}>
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
