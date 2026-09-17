import React, { useState, useEffect } from "react";
import { ArrowRight, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortenDocumentName } from "@/lib/documentName";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadFailure } from "@/components/shared/LoadFailure";
import { Markdown } from "@/components/shared/Markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatGroup } from "@/components/shared/StatGroup";
import { ExtractionQualityPanel } from "@/components/shared/ExtractionQuality";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SourceCitation } from "@/components/shared/SourceCitation";
import {
  MiningDocument,
  ValidationItem,
  QueryResult,
  EvidenceSnippet,
  NavigationTab,
  OrganisationFilter,
} from "@/types";
import { fetchPlatformStats } from "@/services/analytics";
import { ApiError, BackendStats } from "@/services/api";
import { fetchDocuments } from "@/services/documents";
import { fetchValidation } from "@/services/validation";
import { filterByOrganisation } from "@/lib/corpus";
import { fetchRecentQueries } from "@/services/queries";

/**
 * A figure that has not arrived. `text-2xl` is a 32px line box, so this is
 * exactly as tall as the number it stands in for — which is the whole point
 * of it living here rather than in a skeleton copy of the strip.
 */
function StatSkeleton() {
  return <Skeleton className="h-8 w-16" />;
}

/** How many recent questions the dashboard shows before handing off to Ask. */
const RECENT_QUERY_LIMIT = 5;

interface DashboardPageProps {
  onNavigate: (tab: NavigationTab) => void;
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedOrganisation: OrganisationFilter;
}

export function DashboardPage({
  onNavigate,
  onInspectEvidence,
  selectedOrganisation,
}: DashboardPageProps) {
  const [stats, setStats] = useState<BackendStats | null>(null);
  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [validationAlerts, setValidationAlerts] = useState<ValidationItem[]>([]);
  const [recentQueries, setRecentQueries] = useState<QueryResult[]>([]);

  // Whether a table is still waiting is not the same thing as having nothing
  // to show. Measured before this existed: with /reports taking 2.5s — a
  // phone, a cold dyno, conference wifi — the dashboard told a reader with
  // sixteen indexed documents "No documents indexed yet. Upload a report to
  // begin", with no skeleton anywhere on the page to suggest otherwise.
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [isLoadingQueries, setIsLoadingQueries] = useState(true);

  // And every fetch caught into an empty array, so a backend refusing
  // connections rendered identically to a database with nothing in it.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const describe = (err: unknown, what: string) =>
    err instanceof ApiError ? err.message : `Could not load ${what}.`;

  useEffect(() => {
    setIsLoadingDocs(true);
    fetchDocuments()
      .then((docs) => {
        setDocuments(docs);
        setLoadError(null);
      })
      .catch((err) => {
        setDocuments([]);
        setLoadError(describe(err, "the indexed reports"));
      })
      .finally(() => setIsLoadingDocs(false));

    setIsLoadingQueries(true);
    fetchRecentQueries()
      .then(setRecentQueries)
      .catch(() => setRecentQueries([]))
      .finally(() => setIsLoadingQueries(false));
  }, [reloadKey]);

  // Counts are aggregated server-side, so the organisation scope has to go
  // with the request rather than being applied to the result.
  useEffect(() => {
    fetchPlatformStats(selectedOrganisation)
      .then(setStats)
      .catch((err) => {
        setStats(null);
        setLoadError((current) => current ?? describe(err, "the platform counts"));
      });

    setIsLoadingAlerts(true);
    fetchValidation(selectedOrganisation)
      .then((res) => setValidationAlerts(res.findings))
      .catch((err) => {
        setValidationAlerts([]);
        setLoadError((current) => current ?? describe(err, "the validation findings"));
      })
      .finally(() => setIsLoadingAlerts(false));
  }, [selectedOrganisation, reloadKey]);

  const filteredDocs = filterByOrganisation(documents, selectedOrganisation);

  const openAlerts = validationAlerts.filter((a) => a.status === "pending");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Ingestion, extraction and validation across the CMPDI and Coal India document estate."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => onNavigate("ask")}>
              <Sparkles className="h-3.5 w-3.5" />
              Ask DataForge
            </Button>
            <Button size="sm" onClick={() => onNavigate("documents")}>
              <FileText className="h-3.5 w-3.5" />
              Ingest
            </Button>
          </>
        }
      />

      {loadError && (
        <LoadFailure
          message={loadError}
          what="the dashboard"
          onRetry={() => {
            setLoadError(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {/*
        One stat strip replaces eight bordered boxes.

        The strip is always the real one. A separate skeleton block stood in
        for it before, and the two had different box models — border-y against
        border-b, a 68px stack against a 76px one — so the whole page below
        jumped about 7px when the counts landed. That was the largest layout
        shift on the dashboard, and the tab strip underneath was what visibly
        moved.

        Only the four figures are unknown anyway. What the dashboard measures
        is static text, and a reader can start reading it while the numbers
        are still in flight.
      */}
      <StatGroup>
        <Stat
          label="Documents indexed"
          value={stats ? stats.total_reports.toLocaleString("en-IN") : <StatSkeleton />}
          hint="Uploaded to the reports database"
        />
        <Stat
          label="Extracted successfully"
          value={stats ? stats.completed.toLocaleString("en-IN") : <StatSkeleton />}
          tone="success"
          hint="Text and entities extracted"
        />
        <Stat
          label="Questions answered"
          value={stats ? stats.total_queries.toLocaleString("en-IN") : <StatSkeleton />}
          hint="Grounded queries run to date"
        />
        <Stat
          label="Failed extractions"
          value={stats ? stats.errors.toLocaleString("en-IN") : <StatSkeleton />}
          tone={stats && stats.errors > 0 ? "warning" : "success"}
          hint="Documents needing re-upload"
        />
      </StatGroup>

      {/* Coverage and accuracy, side by side and never conflated: a field can
          be fully populated and completely wrong. */}
      <ExtractionQualityPanel quality={stats?.extraction_quality} />

      {/* Operational tables — rows, not stacks of cards */}
      <Tabs defaultValue="documents">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Activity</h2>
          <TabsList>
            {/* "(0)" while a request is in flight is a number nobody has
                counted yet. */}
            <TabsTrigger value="documents">
              Documents{isLoadingDocs ? "" : ` (${filteredDocs.length})`}
            </TabsTrigger>
            <TabsTrigger value="alerts">
              Discrepancies{isLoadingAlerts ? "" : ` (${openAlerts.length})`}
            </TabsTrigger>
            <TabsTrigger value="queries">Queries</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="pt-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Document</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Mine</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingDocs &&
                [0, 1, 2, 3, 4].map((row) => (
                  <TableRow key={`doc-skeleton-${row}`} className="hover:bg-transparent">
                    {Array.from({ length: 5 }).map((_, cell) => (
                      <TableCell key={cell}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {/* Headers over nothing is what a new account sees first, and it
                  reads as broken rather than as empty. Only once the request
                  has come back, though: said while it is still in flight, it
                  is not a state, it is a false statement about the corpus. */}
              {!isLoadingDocs && filteredDocs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No documents indexed yet. Upload a report to begin.
                  </TableCell>
                </TableRow>
              )}
              {!isLoadingDocs && filteredDocs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        {/* Machine-named uploads arrive as one long unbreakable
                            token; rendered raw it pushes the other columns off
                            the screen. The full name stays in the title. */}
                        <div
                          className="font-medium text-foreground"
                          title={doc.filename}
                        >
                          {shortenDocumentName(doc.filename)}
                        </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {/* pageCount is not modelled server-side, so it is
                          usually undefined - rendering the unit regardless
                          left "PDF · pp." on every row. */}
                      {doc.fileType}
                      {doc.pageCount !== undefined && ` · ${doc.pageCount} pp.`}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  {/* Not monospace. Geist Mono is for figures and for machine
                      identifiers - a tonnage, a page number, a snake_case field
                      name - where a fixed advance makes digits line up and
                      signals "this came out of a document, unaltered". "Coal
                      India Limited (CIL)" is a company's name. Set in mono it
                      reads as a database key, which is the opposite of what
                      this column is telling an auditor.

                      And at the row's size, not a step below it: Organisation
                      and Mine are both names, side by side, and two sizes for
                      the same kind of thing reads as an oversight once the
                      typeface no longer explains the difference. */}
                  <TableCell className="text-muted-foreground">
                    {doc.organisation ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{doc.mineName ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono font-medium tabular-nums text-foreground">
                    {/* Every sibling cell falls back to an em dash; this one
                        rendered blank. */}
                    {doc.quantityExtracted ?? "\u2014"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={doc.validationStatus ?? doc.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="alerts" className="pt-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Discrepancy</TableHead>
                <TableHead>Field</TableHead>
                <TableHead className="text-right">Source A</TableHead>
                <TableHead className="text-right">Source B</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingAlerts &&
                [0, 1, 2].map((row) => (
                  <TableRow key={`alert-skeleton-${row}`} className="hover:bg-transparent">
                    {Array.from({ length: 5 }).map((_, cell) => (
                      <TableCell key={cell}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {/* This was written twice — once at colSpan 6 over a table with
                  five columns, once at colSpan 5 below the rows — so an empty
                  tab said it had nothing, twice, in two different widths. */}
              {!isLoadingAlerts && openAlerts.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No open discrepancies. Findings appear here when two reports
                    disagree about the same mine.
                  </TableCell>
                </TableRow>
              )}
              {!isLoadingAlerts && openAlerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{alert.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {alert.mineName ?? alert.sourceA.documentName}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {alert.fieldName}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-warning">
                    {alert.sourceA.value ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-success">
                    {alert.sourceB?.value ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onNavigate("validation")}>
                      Reconcile
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="queries" className="pt-2">
          {isLoadingQueries && (
            <ul className="divide-y divide-border">
              {[0, 1, 2].map((row) => (
                <li key={`query-skeleton-${row}`} className="space-y-2 py-4">
                  <Skeleton className="h-4 w-72" />
                  <Skeleton className="h-3 w-full max-w-2xl" />
                  <Skeleton className="h-3 w-full max-w-xl" />
                </li>
              ))}
            </ul>
          )}

          {/* The other two tabs each say what an empty one means. This one
              rendered an empty list and nothing else. */}
          {!isLoadingQueries && recentQueries.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No questions asked yet. Answers appear here once someone queries
              the corpus.
            </p>
          )}

          <ul className="divide-y divide-border">
            {!isLoadingQueries &&
              recentQueries.slice(0, RECENT_QUERY_LIMIT).map((q) => (
                <li key={q.id} className="py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-sm font-medium text-foreground">{q.question}</h3>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {new Date(q.timestamp).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  {/* Every provider formats its answers in Markdown, and this
                      printed the source: 76 pairs of asterisks were on screen
                      at once, a tab away from the Ask page that renders them. */}
                  <Markdown text={q.answer} className="mt-1.5 max-w-3xl text-muted-foreground" />
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {q.evidence.map((ev) => (
                      <SourceCitation
                        key={ev.id}
                        evidence={ev}
                        compact
                        onClick={() => onInspectEvidence(ev)}
                      />
                    ))}
                  </div>
                </li>
              ))}
          </ul>

          {/* A dashboard summarises. Twenty full answers is the Ask page's job,
              and it is one click away. */}
          {!isLoadingQueries && recentQueries.length > RECENT_QUERY_LIMIT && (
            <div className="pt-4">
              <Button variant="outline" size="sm" onClick={() => onNavigate("ask")}>
                All {recentQueries.length} questions
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
