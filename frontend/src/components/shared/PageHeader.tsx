import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned actions (buttons, filters). */
  actions?: React.ReactNode;
  /** Optional inline element rendered beside the title (e.g. a status badge). */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * Standard page masthead. Hierarchy comes from type scale and the hairline
 * rule beneath it — deliberately not a Card.
 */
export function PageHeader({ title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {meta}
        </div>
        {description && (
          <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {/* Export, ingest and the rest are things to press. On paper they are
          ink spent on controls nobody can reach. */}
      {actions && (
        <div data-print-hide className="flex flex-shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
