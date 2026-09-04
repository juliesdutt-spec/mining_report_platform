import React from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceSnippet } from "@/types";

interface SourceCitationProps {
  evidence: EvidenceSnippet;
  onClick?: () => void;
  /** Drop the document name and show only page + confidence. */
  compact?: boolean;
  className?: string;
}

/**
 * The recurring traceability "receipt": document · page · confidence.
 * Teal is DataForge's grounded-in-a-source signal, used only here and in the
 * evidence surfaces so the association stays legible across the product.
 */
export function SourceCitation({ evidence, onClick, compact = false, className }: SourceCitationProps) {
  // Confidence is optional: real evidence from the backend carries none, so the
  // chip simply omits the percentage rather than showing an invented figure.
  const confPct =
    evidence.confidence !== undefined ? Math.round(evidence.confidence * 100) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${evidence.documentName} — page ${evidence.pageNumber}`}
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded-md border border-teal/20 bg-teal-muted px-2 py-1 text-left text-xs text-teal transition-colors hover:border-teal/40 hover:bg-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        className
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
      {!compact && (
        <span className="truncate font-medium">{evidence.documentName}</span>
      )}
      <span className="shrink-0 font-mono tabular-nums opacity-80">p.{evidence.pageNumber}</span>
      <span className="shrink-0 opacity-40">·</span>
      {confPct !== null && (
        <span className="shrink-0 font-mono tabular-nums opacity-80">{confPct}%</span>
      )}
    </button>
  );
}
