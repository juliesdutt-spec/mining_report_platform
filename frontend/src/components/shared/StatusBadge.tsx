import React from "react";
import { cn } from "@/lib/utils";
import { ValidationStatus } from "@/types";

interface StatusBadgeProps {
  status: ValidationStatus | 'processing' | 'completed' | 'error' | 'pending';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const configs: Record<string, { label: string; dot: string; container: string }> = {
    validated: {
      label: "Validated",
      dot: "bg-emerald-400",
      container: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50",
    },
    completed: {
      label: "Completed",
      dot: "bg-emerald-400",
      container: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50",
    },
    needs_review: {
      label: "In Review",
      dot: "bg-amber-400",
      container: "bg-amber-950/40 text-amber-400 border-amber-800/50",
    },
    conflicting: {
      label: "Discrepancy",
      dot: "bg-rose-400",
      container: "bg-rose-950/40 text-rose-400 border-rose-800/50",
    },
    low_confidence: {
      label: "Low Conf",
      dot: "bg-amber-500",
      container: "bg-amber-950/40 text-amber-300 border-amber-800/50",
    },
    processing: {
      label: "Extracting",
      dot: "bg-sky-400 animate-pulse",
      container: "bg-sky-950/40 text-sky-400 border-sky-800/50",
    },
    pending: {
      label: "Queued",
      dot: "bg-zinc-500",
      container: "bg-zinc-800/60 text-zinc-400 border-zinc-700/50",
    },
    error: {
      label: "Failed",
      dot: "bg-rose-500",
      container: "bg-rose-950/40 text-rose-400 border-rose-800/50",
    },
  };

  const conf = configs[status] || configs.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        conf.container,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", conf.dot)} />
      {conf.label}
    </span>
  );
}
