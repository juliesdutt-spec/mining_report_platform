import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ConfidenceMeter } from "@/components/shared/ConfidenceMeter";
import { FieldLabel } from "@/components/shared/Section";

export interface ComparatorSource {
  documentName: string;
  value?: string | null;
  /** Not modelled by the backend; omitted from the pane when absent. */
  pageNumber?: number;
  confidence?: number;
}

interface SourceComparatorProps {
  /** Field the two sources disagree about, e.g. "annual_production_mt". */
  fieldName: string;
  a: ComparatorSource;
  b?: ComparatorSource;
  /** Labels for each side, e.g. "Annual review" / "Dispatch ledger". */
  labelA?: string;
  labelB?: string;
  className?: string;
}

/**
 * How large to set the disputed value.
 *
 * The panes were sized for a figure — `3,50,000 MT` at 30px reads instantly,
 * which is the whole point of putting the two side by side. But the field in
 * dispute is not always a figure: a duplicate finding disputes `filename`, and
 * `sample_mining_report.pdf` at 30px overran its pane and collided with the
 * one beside it, leaving both values unreadable. Stepping the size down by
 * length keeps a figure emphatic and lets a long value fit; `anywhere` is
 * applied only at the smallest step, so no figure is ever broken mid-number.
 */
export function valueSize(value?: string | null): string {
  const length = (value ?? "").length;
  if (length > 24) return "text-sm [overflow-wrap:anywhere]";
  if (length > 16) return "text-lg [overflow-wrap:anywhere]";
  if (length > 11) return "text-2xl";
  return "text-3xl";
}

function SourcePane({
  label,
  source,
  emphasis,
}: {
  label: string;
  source: ComparatorSource;
  emphasis: "warning" | "success";
}) {
  return (
    <div className="min-w-0 flex-1 p-5">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {source.confidence !== undefined && (
          <ConfidenceMeter value={source.confidence} compact />
        )}
      </div>

      <div
        className={cn(
          "mt-3 font-mono font-semibold tracking-tight tabular-nums",
          valueSize(source.value),
          emphasis === "warning" ? "text-warning" : "text-success"
        )}
      >
        {source.value ?? "\u2014"}
      </div>

      <dl className="mt-4 space-y-1 border-t border-border pt-3 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Document</dt>
          <dd className="min-w-0 truncate text-right font-medium text-foreground" title={source.documentName}>
            {source.documentName}
          </dd>
        </div>
        {source.pageNumber !== undefined && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Page</dt>
            <dd className="font-mono tabular-nums text-foreground">{source.pageNumber}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * Side-by-side reconciliation of two sources that disagree. The two figures sit
 * on a shared baseline so the discrepancy reads instantly, with provenance
 * directly beneath each. DataForge's audit differentiator.
 */
export function SourceComparator({
  fieldName,
  a,
  b,
  labelA = "Source A",
  labelB = "Source B",
  className,
}: SourceComparatorProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-2.5">
        <FieldLabel>Disputed field</FieldLabel>
        <code className="font-mono text-xs font-medium text-foreground">{fieldName}</code>
      </div>

      <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
        <SourcePane label={labelA} source={a} emphasis="warning" />
        {b ? (
          <SourcePane label={labelB} source={b} emphasis="success" />
        ) : (
          <div className="flex min-w-0 flex-1 items-center p-5 text-xs leading-relaxed text-muted-foreground">
            No conflicting secondary source. This item was raised because the extraction fell below
            the OCR confidence threshold.
          </div>
        )}
      </div>
    </Card>
  );
}
