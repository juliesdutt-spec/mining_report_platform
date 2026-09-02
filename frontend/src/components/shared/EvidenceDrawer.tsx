import React from "react";
import { X, FileText, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { EvidenceSnippet } from "@/types";
import { Button } from "@/components/ui/button";

interface EvidenceDrawerProps {
  evidence: EvidenceSnippet | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EvidenceDrawer({ evidence, isOpen, onClose }: EvidenceDrawerProps) {
  if (!isOpen || !evidence) return null;

  const confPct = Math.round(evidence.confidence * 100);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="h-full w-full max-w-lg border-l border-zinc-800 bg-zinc-950 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-400" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Document Evidence Inspector</h3>
                <p className="text-[11px] text-zinc-400">SIH26023 Source Traceability Protocol</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="mt-5 space-y-4">
            {/* Metadata pills */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Document:</span>
                <span className="font-mono text-zinc-200 truncate max-w-[260px]">{evidence.documentName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Page Reference:</span>
                <span className="font-mono text-zinc-200">Page {evidence.pageNumber}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Section Header:</span>
                <span className="text-zinc-300 font-medium">{evidence.sectionHeader}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Extraction Confidence:</span>
                <span className="inline-flex items-center gap-1 font-mono text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  {confPct}% (Verified by AI model)
                </span>
              </div>
            </div>

            {/* Extracted value box */}
            <div>
              <label className="text-xs font-medium text-zinc-400">Extracted Key Value</label>
              <div className="mt-1.5 rounded-md border border-zinc-700/80 bg-zinc-900 p-3">
                <div className="text-xs text-zinc-500 font-mono mb-1">{evidence.field}</div>
                <div className="text-lg font-bold font-mono text-emerald-400">{evidence.extractedValue}</div>
              </div>
            </div>

            {/* Original OCR Context Highlight */}
            <div>
              <label className="text-xs font-medium text-zinc-400 flex items-center justify-between">
                <span>Original Grounded Context</span>
                <span className="text-[11px] text-sky-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Exact OCR Excerpt
                </span>
              </label>
              <div className="mt-1.5 rounded-md border border-zinc-800 bg-zinc-900/70 p-3 text-xs leading-relaxed text-zinc-300 font-serif italic border-l-2 border-l-sky-500">
                "{evidence.originalContext}"
              </div>
            </div>

            {/* Audit compliance note */}
            <div className="rounded border border-zinc-800/80 bg-zinc-900/30 p-3 text-[11px] text-zinc-400 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-zinc-500 flex-shrink-0 mt-0.5" />
              <span>
                All extracted facts maintain deterministic lineage to the archival PDF stored in the local SQLite/CMPDI repository.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Inspector
          </Button>
          <Button variant="default" size="sm" onClick={onClose}>
            Acknowledge & Confirm Lineage
          </Button>
        </div>
      </div>
    </div>
  );
}
