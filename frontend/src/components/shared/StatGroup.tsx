import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: React.ReactNode;
  /** Short change indicator, e.g. "+3.8%". */
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  /** One line of supporting context beneath the value. */
  hint?: string;
  /** Tint the figure to carry meaning (use sparingly). */
  tone?: "default" | "teal" | "success" | "warning" | "destructive";
}

const toneClass: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-foreground",
  teal: "text-teal",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

/**
 * A single figure in a stat strip. Deliberately borderless — the group's
 * dividers and whitespace do the containing, not eight separate cards.
 */
export function Stat({ label, value, delta, deltaType = "neutral", hint, tone = "default" }: StatProps) {
  return (
    <div className="px-5 py-4 first:pl-0 last:pr-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("font-mono text-2xl font-semibold tracking-tight", toneClass[tone])}>
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              deltaType === "positive" && "text-success",
              deltaType === "negative" && "text-destructive",
              deltaType === "neutral" && "text-muted-foreground"
            )}
          >
            {deltaType === "positive" && <ArrowUpRight className="h-3.5 w-3.5" />}
            {deltaType === "negative" && <ArrowDownRight className="h-3.5 w-3.5" />}
            {delta}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/**
 * Horizontal strip of figures separated by hairlines. Replaces grids of KPI
 * cards — same information, far less chrome.
 */
export function StatGroup({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid divide-border border-b border-border sm:divide-x",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
