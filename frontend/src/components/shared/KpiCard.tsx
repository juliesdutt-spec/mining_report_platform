import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  subtitleTop?: string;
  subtitleBottom?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function KpiCard({
  title,
  value,
  delta,
  deltaType = "positive",
  subtitleTop,
  subtitleBottom,
  className,
  icon,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-all duration-200 hover:border-zinc-700/80 hover:bg-zinc-900/90",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-zinc-400">{icon}</span>}
          <span className="text-xs font-medium text-zinc-400">{title}</span>
        </div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium tracking-tight",
              deltaType === "positive" && "bg-emerald-950/70 text-emerald-400 border border-emerald-800/40",
              deltaType === "negative" && "bg-rose-950/70 text-rose-400 border border-rose-800/40",
              deltaType === "neutral" && "bg-zinc-800 text-zinc-400 border border-zinc-700"
            )}
          >
            {deltaType === "positive" && <ArrowUpRight className="h-3 w-3" />}
            {deltaType === "negative" && <ArrowDownRight className="h-3 w-3" />}
            {deltaType === "neutral" && <Minus className="h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="text-2xl font-semibold tracking-tight text-zinc-100 font-mono">
          {value}
        </div>
      </div>

      {(subtitleTop || subtitleBottom) && (
        <div className="mt-2 space-y-0.5 text-[11px] text-zinc-400">
          {subtitleTop && (
            <div className="flex items-center gap-1">
              <span>{subtitleTop}</span>
              {deltaType === "positive" && <ArrowUpRight className="inline h-3 w-3 text-zinc-500" />}
            </div>
          )}
          {subtitleBottom && (
            <div className="text-zinc-500">{subtitleBottom}</div>
          )}
        </div>
      )}
    </div>
  );
}
