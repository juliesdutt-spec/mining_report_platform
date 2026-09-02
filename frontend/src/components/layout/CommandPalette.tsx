import React, { useState } from "react";
import { Search, FileText, Sparkles, Building2, X } from "lucide-react";
import { NavigationTab } from "@/types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavigationTab) => void;
}

export function CommandPalette({ isOpen, onClose, onSelectTab }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const quickLinks = [
    { title: "SECL Gevra Annual Production 2023-24", type: "document", tab: "documents" as NavigationTab },
    { title: "BCCL Jharia Seam XVI Geological Survey", type: "document", tab: "documents" as NavigationTab },
    { title: "Talcher Basin Regional Block V", type: "mine", tab: "explorer" as NavigationTab },
    { title: "Compare coal production between 2022 and 2024", type: "query", tab: "ask" as NavigationTab },
    { title: "Validation Alerts (3 Discrepancies)", type: "action", tab: "validation" as NavigationTab },
  ];

  const filtered = quickLinks.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center border-b border-zinc-800 px-3">
          <Search className="h-4 w-4 text-zinc-400 mr-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, mines, validation alerts or ask AI..."
            className="h-11 w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Suggestions & Recent
          </div>
          <div className="space-y-0.5 mt-1">
            {filtered.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onSelectTab(item.tab);
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded px-2.5 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 text-left transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  {item.type === "document" && <FileText className="h-3.5 w-3.5 text-zinc-400" />}
                  {item.type === "query" && <Sparkles className="h-3.5 w-3.5 text-sky-400" />}
                  {item.type === "mine" && <Building2 className="h-3.5 w-3.5 text-emerald-400" />}
                  <span className="truncate">{item.title}</span>
                </div>
                <span className="text-[10px] font-mono uppercase text-zinc-500">{item.type}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500 flex justify-between">
          <span>Press ESC to close</span>
          <span>DataForge Intelligence v1.0</span>
        </div>
      </div>
    </div>
  );
}
