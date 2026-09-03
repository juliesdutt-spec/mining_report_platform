import React from "react";
import { cn } from "@/lib/utils";
import { ValidationStatus } from "@/types";

interface StatusBadgeProps {
  status: ValidationStatus | "processing" | "completed" | "error" | "pending";
  className?: string;
}

type StatusConfig = { label: string; dot: string; text: string };

const CONFIGS: Record<string, StatusConfig> = {
  validated: { label: "Validated", dot: "bg-success", text: "text-success" },
  completed: { label: "Completed", dot: "bg-success", text: "text-success" },
  needs_review: { label: "In review", dot: "bg-warning", text: "text-warning" },
  low_confidence: { label: "Low confidence", dot: "bg-warning", text: "text-warning" },
  conflicting: { label: "Discrepancy", dot: "bg-destructive", text: "text-destructive" },
  error: { label: "Failed", dot: "bg-destructive", text: "text-destructive" },
  processing: { label: "Extracting", dot: "bg-primary animate-pulse", text: "text-primary" },
  pending: { label: "Queued", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

/**
 * Status is carried by a small colour dot plus a plain label — not a filled,
 * bordered pill. Keeps dense tables calm while staying scannable.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const conf = CONFIGS[status] ?? CONFIGS.pending;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", conf.text, className)}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", conf.dot)} />
      {conf.label}
    </span>
  );
}
