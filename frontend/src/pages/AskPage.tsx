import React, { useState, useEffect } from "react";
import { AlertCircle, ArrowRight, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section, FieldLabel } from "@/components/shared/Section";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { ConfidenceMeter } from "@/components/shared/ConfidenceMeter";
import { QueryResult, EvidenceSnippet, Subsidiary } from "@/types";
import { askDataForgeQuery, fetchRecentQueries } from "@/services/queries";
import { fetchDocuments } from "@/services/documents";
import { ApiError } from "@/services/api";

interface AskPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

const EXAMPLES = [
  "Compare coal production and stripping ratios across SECL and NCL in FY 2023-24.",
  "What are the proved reserves and seam thicknesses in Talcher Basin Block V?",
  "Summarise prime coking coal extraction at Moonidih and methane pre-drainage levels.",
  "Verify bio-reclamation targets achieved at Lakhanpur OC.",
];

export function AskPage({ onInspectEvidence, selectedSubsidiary }: AskPageProps) {
  const [queryInput, setQueryInput] = useState("");
  const [activeResult, setActiveResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [indexedCount, setIndexedCount] = useState<number | null>(null);

  // Report how many documents are actually indexed, rather than a fixed figure.
  useEffect(() => {
    fetchDocuments()
      .then((docs) => setIndexedCount(docs.length))
      .catch(() => setIndexedCount(null));
  }, []);

  // Show the most recent question from GET /query-history on first load.
  useEffect(() => {
    fetchRecentQueries()
      .then((queries) => {
        if (queries.length > 0) setActiveResult(queries[0]);
      })
      .catch(() => {
        /* History is a convenience; a cold or offline backend is not an error here. */
      });
  }, []);

  const handleRunQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsLoading(true);
    setQueryError(null);
    try {
      const res = await askDataForgeQuery(queryText);
      setActiveResult(res);
    } catch (err) {
      setQueryError(
        err instanceof ApiError ? err.message : "The query failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ask DataForge"
        description="Answers are synthesised only from indexed CMPDI and subsidiary reports, and every claim carries the page it came from."
      />

      {/* Query bar — the primary action on the page */}
      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunQuery(queryInput);
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Ask about production, reserves, compliance…"
              aria-label="Ask a question"
              className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-4 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            />
          </div>
          <Button type="submit" size="lg" disabled={isLoading || !queryInput.trim()}>
            {isLoading ? "Searching sources…" : "Ask"}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <FieldLabel>Try</FieldLabel>
          {EXAMPLES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setQueryInput(q);
                handleRunQuery(q);
              }}
              className="max-w-sm truncate text-left text-xs text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {q}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {indexedCount === null
            ? "Grounded in the indexed report corpus"
            : `Grounded in ${indexedCount.toLocaleString("en-IN")} indexed ${
                indexedCount === 1 ? "report" : "reports"
              }`}{" "}
          · Scope:{" "}
          <span className="font-medium text-foreground">
            {selectedSubsidiary === "ALL" ? "All subsidiaries" : selectedSubsidiary}
          </span>
        </p>
      </div>

      {queryError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-muted px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{queryError}</span>
        </div>
      )}

      {activeResult && (
        <div className="space-y-8">
          {/* The answer — a quiet rule, not a glowing panel */}
          <section className="border-l-2 border-primary pl-5">
            <h2 className="text-lg font-semibold leading-snug tracking-tight text-foreground">
              {activeResult.question}
            </h2>
            <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {activeResult.answer}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {activeResult.evidence.map((ev) => (
                <SourceCitation
                  key={ev.id}
                  evidence={ev}
                  compact
                  onClick={() => onInspectEvidence(ev)}
                />
              ))}
            </div>
          </section>

          {activeResult.keyFindings.length > 0 && (
            <>
              <Separator />

              {/* Key findings — a list, not a grid of boxes */}
              <Section title="Key findings">
                <ol className="max-w-3xl space-y-3">
                  {activeResult.keyFindings.map((finding, idx) => (
                    <li key={idx} className="flex gap-3 text-sm leading-relaxed text-foreground">
                      <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            </>
          )}

          {activeResult.evidence.length > 0 && (
            <>
              <Separator />

              {/* Evidence — the one place cards genuinely earn their keep */}
              <Section
                title="Evidence"
                description="The exact passages this answer was drawn from. Open one to inspect its source page."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {activeResult.evidence.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onInspectEvidence(ev)}
                  className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-xs transition-colors hover:border-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{ev.sectionHeader}</span>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-teal" />
                  </div>

                  <blockquote className="border-l-2 border-teal bg-teal-muted/50 py-2 pl-3 pr-2 font-serif text-sm leading-relaxed text-foreground">
                    {ev.originalContext}
                  </blockquote>

                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate" title={ev.documentName}>
                      {ev.documentName} · p.{ev.pageNumber}
                    </span>
                    <ConfidenceMeter value={ev.confidence} compact />
                  </div>
                </button>
              ))}
                </div>
              </Section>
            </>
          )}

          <Separator />

          {/* Sources */}
          <Section
            title="Sources"
            description="The indexed reports this answer drew on."
          >
            {activeResult.sourceDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                The backend did not report which documents this answer drew on.
              </p>
            ) : (
            <ul className="divide-y divide-border border-y border-border">
              {activeResult.sourceDocuments.map((src) => (
                <li
                  key={src.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {src.filename}
                  </span>
                  {src.pageNumbers && src.pageNumbers.length > 0 && (
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      pp. {src.pageNumbers.join(", ")}
                    </span>
                  )}
                  {src.relevanceScore !== undefined && (
                    <span className="font-mono text-xs tabular-nums text-teal">
                      {Math.round(src.relevanceScore * 100)}% match
                    </span>
                  )}
                </li>
              ))}
            </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
