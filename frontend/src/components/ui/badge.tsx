import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "cyan";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors tracking-tight";
  const variants = {
    default: "bg-zinc-800 text-zinc-100 border border-zinc-700",
    secondary: "bg-zinc-900 text-zinc-400 border border-zinc-800",
    outline: "text-zinc-400 border border-zinc-800",
    success: "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60",
    warning: "bg-amber-950/60 text-amber-400 border border-amber-800/60",
    destructive: "bg-rose-950/60 text-rose-400 border border-rose-800/60",
    cyan: "bg-sky-950/60 text-sky-400 border border-sky-800/60",
  };
  return <div className={cn(base, variants[variant], className)} {...props} />;
}
