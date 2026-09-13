import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
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
export function ExtractionQualityPanel({ quality }: { quality?: Quality }) {
  if (!quality) return null;

  const { completeness, measured, fields } = quality;
  const coverage = completeness.ratio;

  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
      {/* ---------------------------------------------------- coverage --- */}
      <div className="bg-card p-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Field coverage
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* The icon stays 14px; the button is padded out to a 24px
                  hit area, which is the minimum a finger can reliably find. */}
              <button
                type="button"
                aria-label="What field coverage means"
                className="-m-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              How many of the {fields.length} fields that findings depend on came
              back populated. A populated field can still hold a wrong value, so
              this is coverage, not accuracy.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">
          {coverage === null ? "—" : `${Math.round(coverage * 100)}%`}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {completeness.fieldsPopulated.toLocaleString("en-IN")} of{" "}
          {completeness.fieldsExpected.toLocaleString("en-IN")} fields across{" "}
          {completeness.documents.toLocaleString("en-IN")} document
          {completeness.documents === 1 ? "" : "s"}
        </p>
      </div>

      {/* ---------------------------------------------------- accuracy --- */}
      <div className="bg-card p-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Extraction accuracy
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="What extraction accuracy means"
                className="-m-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Measured by scoring extraction against documents a person has read
              by hand. Coverage is not a substitute — a field can be complete and
              wrong.
            </TooltipContent>
          </Tooltip>
        </div>

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
            <p className="mt-1 text-xs text-muted-foreground">
              Label a few reports and run{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                python -m evaluation.score
              </code>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
