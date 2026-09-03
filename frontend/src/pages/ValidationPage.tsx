import React, { useState, useEffect } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section, FieldLabel } from "@/components/shared/Section";
import { Stat, StatGroup } from "@/components/shared/StatGroup";
import { SourceComparator } from "@/components/shared/SourceComparator";
import { cn } from "@/lib/utils";
import { ValidationItem, EvidenceSnippet, Subsidiary } from "@/types";
import { fetchValidationItems, markItemValidated } from "@/services/validation";

interface ValidationPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

/** Severity is carried by a left rule on the queue row, not a filled badge. */
const SEVERITY_RULE: Record<ValidationItem["type"], string> = {
  conflict: "bg-destructive",
  low_confidence: "bg-warning",
  missing_data: "bg-warning",
  duplicate: "bg-muted-foreground",
};

const TYPE_LABEL: Record<ValidationItem["type"], string> = {
  conflict: "Value conflict",
  low_confidence: "Low confidence",
  missing_data: "Missing data",
  duplicate: "Duplicate",
};

export function ValidationPage({ selectedSubsidiary }: ValidationPageProps) {
  const [items, setItems] = useState<ValidationItem[]>([]);
  const [activeItem, setActiveItem] = useState<ValidationItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("all");

  useEffect(() => {
    fetchValidationItems().then((res) => {
      setItems(res);
      if (res.length > 0) setActiveItem(res[0]);
    });
  }, []);

  const handleResolve = async (id: string, note: string) => {
    const updated = await markItemValidated(id, note);
    setItems(updated);
    const curr = updated.find((i) => i.id === id);
    if (curr) setActiveItem(curr);
  };

  const filtered = items.filter((item) => {
    const matchesSub = selectedSubsidiary === "ALL" || item.subsidiary === selectedSubsidiary;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSub && matchesStatus;
  });

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const conflictCount = items.filter((i) => i.type === "conflict").length;
  const lowConfCount = items.filter((i) => i.type === "low_confidence").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Validation & traceability"
        description="Reconcile conflicting figures across subsidiary ledgers and verify low-confidence extractions against their source pages."
      />

      <StatGroup>
        <Stat label="Audited records" value="94,620" hint="Across 8 subsidiaries" />
        <Stat label="Compliance rate" value="98.6%" tone="success" delta="+0.4%" deltaType="positive" />
        <Stat label="Value conflicts" value={conflictCount} tone="destructive" hint="Awaiting reconciliation" />
        <Stat label="Low-confidence scans" value={lowConfCount} tone="warning" hint="Below OCR threshold" />
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
              {filtered.map((item) => {
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
                        <span aria-hidden>·</span>
                        <span className="font-mono">{item.subsidiary}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{item.mineName}</span>
                      </div>
                    </button>
                  </li>
                );
              })}

              {filtered.length === 0 && (
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
              description={`${activeItem.subsidiary} · ${activeItem.mineName}`}
            >
              <SourceComparator
                fieldName={activeItem.fieldName}
                a={activeItem.sourceA}
                b={activeItem.sourceB}
                labelA="Annual review"
                labelB="Dispatch ledger"
              />

              <div className="pt-2">
                <FieldLabel>Reconciliation note</FieldLabel>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The variance arises between the annual review figure and the subsidiary dispatch
                  ledger, which records net railway weighbridge tickets. Where the two disagree, the
                  weighbridge ledger is normally treated as the statutory figure.
                </p>
              </div>

              <Separator />

              {activeItem.status === "resolved" ? (
                <p className="flex items-start gap-2 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{activeItem.resolutionNote || "Marked validated by the auditor."}</span>
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleResolve(activeItem.id, "Flagged for physical audit by the CMPDI regional institute")
                    }
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
                            `Reconciled to the dispatch ledger figure (${activeItem.sourceB?.value})`
                          )
                        }
                      >
                        Adopt {activeItem.sourceB.value}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() =>
                        handleResolve(activeItem.id, `Validated ${activeItem.sourceA.value} against the source page`)
                      }
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
