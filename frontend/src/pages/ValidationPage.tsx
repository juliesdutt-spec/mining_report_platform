import React, { useState, useEffect } from "react";
import { AlertCircle, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section, FieldLabel } from "@/components/shared/Section";
import { Stat, StatGroup } from "@/components/shared/StatGroup";
import { SourceComparator } from "@/components/shared/SourceComparator";
import { cn } from "@/lib/utils";
import { ValidationItem, EvidenceSnippet, OrganisationFilter } from "@/types";
import { fetchValidation, resolveValidationFinding } from "@/services/validation";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/services/api";

interface ValidationPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedOrganisation: OrganisationFilter;
}

/** Severity is carried by a left rule on the queue row, not a filled badge. */
const SEVERITY_RULE: Record<ValidationItem["type"], string> = {
  conflict: "bg-destructive",
  extraction_error: "bg-destructive",
  missing_data: "bg-warning",
  duplicate: "bg-muted-foreground",
};

const TYPE_LABEL: Record<ValidationItem["type"], string> = {
  conflict: "Value conflict",
  extraction_error: "Extraction failed",
  missing_data: "Missing data",
  duplicate: "Duplicate",
};

export function ValidationPage({ selectedOrganisation }: ValidationPageProps) {
  const [items, setItems] = useState<ValidationItem[]>([]);
  const [activeItem, setActiveItem] = useState<ValidationItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  /** GET /validation — findings recomputed by the backend on every call. */
  const load = async (keepId?: string) => {
    setIsLoading(true);
    try {
      const res = await fetchValidation(selectedOrganisation);
      setItems(res.findings);
      setLoadError(null);
      setActiveItem((current) => {
        const target = keepId ?? current?.id;
        return res.findings.find((f) => f.id === target) ?? res.findings[0] ?? null;
      });
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load findings.");
      setItems([]);
      setActiveItem(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Findings are computed over the scoped corpus, so a change of
    // organisation means a different set of comparisons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrganisation]);

  const handleResolve = async (
    id: string,
    status: "resolved" | "flagged" | "pending",
    note?: string
  ) => {
    setIsResolving(true);
    setActionError(null);
    try {
      await resolveValidationFinding(id, status, note);
      await load(id);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Could not record that decision."
      );
    } finally {
      setIsResolving(false);
    }
  };

  const filtered = items.filter((item) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" ? item.status === "pending" : item.status !== "pending");
    return matchesStatus;
  });

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const conflictCount = items.filter((i) => i.type === "conflict").length;
  const duplicateCount = items.filter((i) => i.type === "duplicate").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Validation & traceability"
        description="Every figure this platform reports comes from a document. Validation is the check that those documents agree with each other."
      />

      {/* First-time readers arrive here without knowing what a "finding" is or
          what they are expected to do about one. The four types below are
          exactly what validation_engine.detect_discrepancies produces. */}
      <section
        aria-labelledby="validation-explainer"
        className="rounded-lg border border-border bg-card px-5 py-4"
      >
        <h2
          id="validation-explainer"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          What this page checks
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          A consolidated report is only trustworthy if the documents behind it
          say the same thing. Every time a document is indexed, DataForge
          re-compares the whole corpus and lists what does not line up — so a
          disagreement is caught here rather than inside a published figure.
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {[
            {
              term: "Value conflict",
              rule: "bg-destructive",
              detail:
                "Two reports state different figures for the same mine and field — for example one records 3,50,000 MT and another 2,90,000 MT. Both sources are shown side by side so you can decide which document governs.",
            },
            {
              term: "Extraction failed",
              rule: "bg-destructive",
              detail:
                "The document was ingested but no data could be read from it. Nothing from it is contributing to any total, so a report built now would silently omit it.",
            },
            {
              term: "Missing data",
              rule: "bg-warning",
              detail:
                "Mineral type, quantity or location could not be found in the document. Aggregates that rely on that field exclude this report.",
            },
            {
              term: "Duplicate",
              rule: "bg-muted-foreground",
              detail:
                "The same document was ingested more than once, which would double-count its figures in any total.",
            },
          ].map((entry) => (
            <div key={entry.term} className="relative pl-4">
              <span
                aria-hidden
                className={cn("absolute inset-y-1 left-0 w-0.5 rounded", entry.rule)}
              />
              <dt className="text-sm font-medium text-foreground">{entry.term}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                {entry.detail}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">What to do with a finding:</span>{" "}
          open it, read the passage each figure came from — every finding links
          back to the page of the source document — and decide which reading is
          correct. Marking it resolved records that an auditor has seen it; it
          does not edit the underlying document, so the audit trail from figure
          to source page stays intact.
        </p>
      </section>

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-muted px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-muted px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <StatGroup>
        <Stat label="Open findings" value={pendingCount} tone={pendingCount > 0 ? "warning" : "success"} hint="Awaiting an auditor decision" />
        <Stat label="Value conflicts" value={conflictCount} tone="destructive" hint="Reports that disagree" />
        <Stat label="Duplicates" value={duplicateCount} hint="Same document ingested twice" />
        <Stat label="Total findings" value={items.length} hint="Computed from indexed reports" />
      </StatGroup>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Triage queue */}
        <div className="lg:col-span-5">
          <Section
            title="Triage queue"
            actions={
              <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="pending">Open ({pendingCount})</TabsTrigger>
                  <TabsTrigger value="resolved">Resolved</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            <ul className="divide-y divide-border border-y border-border">
              {isLoading &&
                [0, 1, 2].map((i) => (
                  <li key={`sk-${i}`}>
                    <Skeleton className="h-20 w-full" />
                  </li>
                ))}

              {!isLoading && filtered.map((item) => {
                const isSelected = activeItem?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveItem(item)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "relative flex w-full flex-col gap-1 py-3.5 pl-4 pr-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        isSelected ? "bg-accent" : "hover:bg-muted/60"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-0.5",
                          item.status === "resolved" ? "bg-success" : SEVERITY_RULE[item.type]
                        )}
                        aria-hidden
                      />
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                        {item.status === "resolved" && (
                          <span className="shrink-0 text-xs font-medium text-success">Resolved</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{TYPE_LABEL[item.type]}</span>
                        {item.organisation && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate font-mono">{item.organisation}</span>
                          </>
                        )}
                        {item.mineName && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{item.mineName}</span>
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}

              {!isLoading && filtered.length === 0 && (
                <li className="py-12 text-center text-sm text-muted-foreground">
                  Nothing in the queue for this filter.
                </li>
              )}
            </ul>
          </Section>
        </div>

        {/* Reconciliation detail */}
        <div className="lg:col-span-7">
          {activeItem ? (
            <Section
              title={activeItem.title}
              description={activeItem.mineName ?? `Field: ${activeItem.fieldName}`}
            >
              <SourceComparator
                fieldName={activeItem.fieldName}
                a={activeItem.sourceA}
                b={activeItem.sourceB ?? undefined}
                labelA="First report"
                labelB="Second report"
              />

              <div className="pt-2">
                <FieldLabel>Reconciliation note</FieldLabel>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {activeItem.detail ??
                    "This finding was raised automatically from the indexed reports."}
                </p>
              </div>

              <Separator />

              {activeItem.status !== "pending" ? (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="flex items-start gap-2 text-sm text-success">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {activeItem.resolutionNote ||
                        `Marked ${activeItem.status} by the auditor.`}
                    </span>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResolve(activeItem.id, "pending")}
                    disabled={isResolving}
                  >
                    Reopen
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleResolve(
                        activeItem.id,
                        "flagged",
                        "Flagged for physical audit by the CMPDI regional institute"
                      )
                    }
                    disabled={isResolving}
                  >
                    Flag for site inspection
                  </Button>

                  <div className="flex items-center gap-2">
                    {activeItem.sourceB && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleResolve(
                            activeItem.id,
                            "resolved",
                            `Adopted the second report's value (${activeItem.sourceB?.value})`
                          )
                        }
                        disabled={isResolving}
                      >
                        Adopt {activeItem.sourceB.value}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() =>
                        handleResolve(
                          activeItem.id,
                          "resolved",
                          `Validated ${activeItem.sourceA.value ?? "this record"} against the source document`
                        )
                      }
                      disabled={isResolving}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Mark validated
                    </Button>
                  </div>
                </div>
              )}
            </Section>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Select an item to compare its sources.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
