import React from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Draw a hairline under the section heading. */
  divided?: boolean;
}

/**
 * A content section built from typography, space and a hairline instead of a
 * Card. This is the default container in DataForge — reach for Card only when
 * containment genuinely aids comprehension.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  divided = false,
}: SectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || actions) && (
        <div
          className={cn(
            "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
            divided && "border-b border-border pb-3"
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
            )}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Small uppercase label for column heads and metadata groups. */
export function FieldLabel({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
