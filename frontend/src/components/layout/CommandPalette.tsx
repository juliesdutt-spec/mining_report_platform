import React from "react";
import { BarChart3, Database, FileText, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { NavigationTab } from "@/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavigationTab) => void;
}

const DESTINATIONS: { label: string; tab: NavigationTab; icon: typeof FileText }[] = [
  { label: "Dashboard", tab: "dashboard", icon: BarChart3 },
  { label: "Documents", tab: "documents", icon: FileText },
  { label: "Ask DataForge", tab: "ask", icon: Sparkles },
  { label: "Data Explorer", tab: "explorer", icon: Database },
  { label: "Validation", tab: "validation", icon: ShieldCheck },
  { label: "Settings", tab: "settings", icon: Settings },
];

const RECENTS: { label: string; tab: NavigationTab }[] = [
  { label: "SECL Gevra Annual Production 2023-24", tab: "documents" },
  { label: "BCCL Jharia Seam XVI Geological Survey", tab: "documents" },
  { label: "Talcher Basin Regional Block V", tab: "explorer" },
];

export function CommandPalette({ isOpen, onClose, onSelectTab }: CommandPaletteProps) {
  const go = (tab: NavigationTab) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <CommandInput placeholder="Search documents, mines, or jump to a section…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Go to">
          {DESTINATIONS.map((d) => {
            const Icon = d.icon;
            return (
              <CommandItem key={d.tab} value={d.label} onSelect={() => go(d.tab)}>
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{d.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandGroup heading="Recent documents">
          {RECENTS.map((r) => (
            <CommandItem key={r.label} value={r.label} onSelect={() => go(r.tab)}>
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{r.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
