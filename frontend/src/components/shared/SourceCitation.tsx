import React from "react";
import { FileText, ExternalLink, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceSnippet } from "@/types";

interface SourceCitationProps {
  evidence: EvidenceSnippet;
  onClick?: () => void;
  className?: string;
}

export function SourceCitation({ evidence, onClick, className }: SourceCitationProps) {
  const confPct = Math.round(evidence.confidence * 100);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-left text-xs transition-all hover:border-zinc-700 hover:bg-zinc-850",
        className
      )}
    >
      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" />
      <div className="flex items-center gap-1.5 truncate">
        <span className="font-mono text-zinc-300 truncate max-w-[190px]">{evidence.documentName}</span>
        <span className="text-zinc-500">•</span>
        <span className="text-zinc-400">p.{evidence.pageNumber}</span>
        <span className="text-zinc-500">•</span>
        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-800/40">
          <ShieldCheck className="h-2.5 w-2.5" />
          {confPct}%
        </span>
      </div>
      <ExternalLink className="h-3 w-3 text-zinc-600 group-hover:text-zinc-300 ml-auto" />
    </button>
  );
}
