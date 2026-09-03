import React from "react";
import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  /** Extraction confidence, 0–1. */
  value: number;
  /** Hide the bar and show only the figure. */
  compact?: boolean;
  className?: string;
}

/** Confidence thresholds mirror the OCR review triggers used by Validation. */
function toneFor(pct: number) {
  if (pct >= 95) return { bar: "bg-success", text: "text-success" };
  if (pct >= 90) return { bar: "bg-teal", text: "text-teal" };
  return { bar: "bg-warning", text: "text-warning" };
}

/**
 * Extraction confidence, rendered as a quiet meter plus a tabular figure.
 * Part of the evidence vocabulary — the same reading everywhere it appears.
 */
export function ConfidenceMeter({ value, compact = false, className }: ConfidenceMeterProps) {
  const pct = Math.round(value * 100);
  const tone = toneFor(pct);

  if (compact) {
    return (
      <span className={cn("font-mono text-xs font-medium", tone.text, className)}>{pct}%</span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Extraction confidence"
      >
        <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn("font-mono text-xs font-medium tabular-nums", tone.text)}>{pct}%</span>
    </span>
  );
}
