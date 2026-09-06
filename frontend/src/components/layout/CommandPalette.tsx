import React from "react";
import { BarChart3, Database, FileText, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { NavigationTab } from "@/types";
import { useCorpus } from "@/lib/corpus";
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
  onSelectTab: (tab: NavigationTab, param?: string) => void;
}

const DESTINATIONS: { label: string; tab: NavigationTab; icon: typeof FileText }[] = [
  { label: "Dashboard", tab: "dashboard", icon: BarChart3 },
  { label: "Documents", tab: "documents", icon: FileText },
  { label: "Ask DataForge", tab: "ask", icon: Sparkles },
  { label: "Data Explorer", tab: "explorer", icon: Database },
  { label: "Validation", tab: "validation", icon: ShieldCheck },
  { label: "Settings", tab: "settings", icon: Settings },
];

/** How many of the most recently uploaded documents the palette offers. */
const RECENT_LIMIT = 5;

export function CommandPalette({ isOpen, onClose, onSelectTab }: CommandPaletteProps) {
  // Recents are the documents actually in the index, newest first — the list
  // is empty until something has been uploaded rather than pre-filled.
  const { documents, isLoading } = useCorpus();

  const recents = [...documents]
    .sort((a, b) => (b.uploadDate ?? "").localeCompare(a.uploadDate ?? ""))
    .slice(0, RECENT_LIMIT);

  const go = (tab: NavigationTab, param?: string) => {
    onSelectTab(tab, param);
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

        {!isLoading && recents.length > 0 && (
          <CommandGroup heading="Recent documents">
            {recents.map((doc) => (
              <CommandItem
                key={doc.id}
                // Searching by mine name should find the document too.
                value={`${doc.filename} ${doc.mineName ?? ""} ${doc.organisation ?? ""}`}
                onSelect={() => go("documents", String(doc.id))}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.filename}</span>
                {doc.mineName && (
                  <span className="ml-auto shrink-0 truncate pl-3 text-xs text-muted-foreground">
                    {doc.mineName}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
