import React from "react";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExtractionQuality as Quality } from "@/services/api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * How good the extraction is — as two figures that are never conflated.
 *
 * Coverage is computable from the corpus on screen: how many of the fields
 * findings depend on actually came back. Accuracy needs documents a person
 * has read, and until someone has scored them it is genuinely unknown.
 *
 * Showing coverage where accuracy belongs would be the easy lie here: a field
 * can be fully populated and completely wrong, and on a compliance tool that
 * substitution is exactly the kind of number that gets believed. So the
 * unmeasured state says so, and says how to fix it.
 */
/**
 * One half of the panel: the label, its explanation, and whatever figure is
 * underneath. Shared by the loaded and the loading states rather than written
 * out twice — two copies of a box model is how the stat strip above this one
 * ended up 7px shorter while it waited.
 */
function QualityCell({
  label,
  help,
  children,
}: {
  label: string;
  help: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card p-4">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* The icon stays 14px; the button is padded out to a 24px hit
                area, which is the minimum a finger can reliably find. */}
            <button
              type="button"
              aria-label={`What ${label.toLowerCase()} means`}
              className="-m-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{help}</TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}

const FRAME = "grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2";

export function ExtractionQualityPanel({ quality }: { quality?: Quality }) {
  /*
    Returning null while the counts were in flight was the largest layout
    shift on the dashboard: the panel was simply absent, and then appeared
    and pushed the Activity section 111px down the page. Both labels are
    static text, so there was never a reason to withhold them — only the two
    figures are unknown, and they are the same height either way.
  */
  if (!quality) {
    return (
      <div className={FRAME}>
        <QualityCell
          label="Field coverage"
          help="How many of the fields that findings depend on came back populated. A populated field can still hold a wrong value, so this is coverage, not accuracy."
        >
          <Skeleton className="mt-2 h-8 w-20" />
          <Skeleton className="mt-1 h-4 w-48" />
        </QualityCell>
        <QualityCell
          label="Extraction accuracy"
          help="Measured by scoring extraction against documents a person has read by hand. Coverage is not a substitute — a field can be complete and wrong."
        >
          <Skeleton className="mt-2 h-8 w-32" />
          <Skeleton className="mt-1 h-4 w-56" />
        </QualityCell>
      </div>
    );
  }

  const { completeness, measured, fields } = quality;
  const coverage = completeness.ratio;

  return (
    <div className={FRAME}>
      <QualityCell
        label="Field coverage"
        help={`How many of the ${fields.length} fields that findings depend on came back populated. A populated field can still hold a wrong value, so this is coverage, not accuracy.`}
      >
        <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">
          {coverage === null ? "\u2014" : `${Math.round(coverage * 100)}%`}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {completeness.fieldsPopulated.toLocaleString("en-IN")} of{" "}
          {completeness.fieldsExpected.toLocaleString("en-IN")} fields across{" "}
          {completeness.documents.toLocaleString("en-IN")} document
          {completeness.documents === 1 ? "" : "s"}
        </p>
      </QualityCell>

      <QualityCell
        label="Extraction accuracy"
        help="Measured by scoring extraction against documents a person has read by hand. Coverage is not a substitute — a field can be complete and wrong."
      >
        {measured ? (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                {Math.round(measured.accuracy * 100)}%
              </span>
              {measured.wrong > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {measured.wrong} wrong
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  none wrong
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {measured.fieldsScored} fields over {measured.documents} hand-read
              document{measured.documents === 1 ? "" : "s"} · {measured.exact} exact,{" "}
              {measured.equivalent} equivalent, {measured.missing} missing
            </p>
          </>
        ) : (
          <>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-muted-foreground">
              Not measured
            </div>
            {/* This used to name the command a developer runs. Whoever is
                reading this screen is an auditor, not the person who built it:
                say what the number would mean, not how it gets produced. */}
            <p className="mt-1 text-xs text-muted-foreground">
              Scored against reports checked by hand. No scored run has been
              recorded for this corpus yet.
            </p>
          </>
        )}
      </QualityCell>
    </div>
  );
}
