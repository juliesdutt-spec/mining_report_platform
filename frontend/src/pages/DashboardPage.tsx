import React, { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Section } from "@/components/shared/Section";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatGroup } from "@/components/shared/StatGroup";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceMeter } from "@/components/shared/ConfidenceMeter";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { useChartColors, tooltipStyle } from "@/lib/chart";
import {
  KpiMetrics,
  MiningDocument,
  ProductionDataPoint,
  ValidationItem,
  QueryResult,
  EvidenceSnippet,
  NavigationTab,
  Subsidiary,
} from "@/types";
import { fetchPlatformStats } from "@/services/analytics";
import { BackendStats } from "@/services/api";
import { fetchDocuments } from "@/services/documents";
import { fetchValidation } from "@/services/validation";
import { fetchRecentQueries } from "@/services/queries";

interface DashboardPageProps {
  onNavigate: (tab: NavigationTab) => void;
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

export function DashboardPage({
  onNavigate,
  onInspectEvidence,
  selectedSubsidiary,
}: DashboardPageProps) {
  const [stats, setStats] = useState<BackendStats | null>(null);
  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [validationAlerts, setValidationAlerts] = useState<ValidationItem[]>([]);
  const [recentQueries, setRecentQueries] = useState<QueryResult[]>([]);
  const colors = useChartColors();

  useEffect(() => {
    fetchPlatformStats()
      .then(setStats)
      .catch(() => setStats(null));
    fetchDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]));
    fetchValidation()
      .then((res) => setValidationAlerts(res.findings))
      .catch(() => setValidationAlerts([]));
    fetchRecentQueries()
      .then(setRecentQueries)
      .catch(() => setRecentQueries([]));
  }, []);


  const filteredDocs =
    selectedSubsidiary === "ALL"
      ? documents
      : documents.filter((d) => d.subsidiary === selectedSubsidiary);

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

      {/* One stat strip replaces eight bordered boxes */}
      {stats === null ? (
        <div className="grid grid-cols-2 gap-6 border-y border-border py-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : (
      <StatGroup>
        <Stat
          label="Documents indexed"
          value={stats ? stats.total_reports.toLocaleString("en-IN") : "\u2014"}
          hint="Uploaded to the reports database"
        />
        <Stat
          label="Extracted successfully"
          value={stats ? stats.completed.toLocaleString("en-IN") : "\u2014"}
          tone="success"
          hint="Text and entities extracted"
        />
        <Stat
          label="Questions answered"
          value={stats ? stats.total_queries.toLocaleString("en-IN") : "\u2014"}
          hint="Grounded queries run to date"
        />
        <Stat
          label="Failed extractions"
          value={stats ? stats.errors.toLocaleString("en-IN") : "\u2014"}
          tone={stats && stats.errors > 0 ? "warning" : "success"}
          hint="Documents needing re-upload"
        />
      </StatGroup>
      )}

      {/* Operational tables — rows, not stacks of cards */}
      <Tabs defaultValue="documents">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Activity</h2>
          <TabsList>
            <TabsTrigger value="documents">Documents ({filteredDocs.length})</TabsTrigger>
            <TabsTrigger value="alerts">Discrepancies ({openAlerts.length})</TabsTrigger>
            <TabsTrigger value="queries">Queries</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="pt-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Document</TableHead>
                <TableHead>Subsidiary</TableHead>
                <TableHead>Mine</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{doc.filename}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {doc.fileType} · {doc.pageCount} pp.
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {doc.subsidiary}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{doc.mineName}</TableCell>
                  <TableCell className="text-right font-mono font-medium tabular-nums text-foreground">
                    {doc.quantityExtracted}
                  </TableCell>
                  <TableCell>
                    <ConfidenceMeter value={doc.confidenceScore} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={doc.validationStatus ?? doc.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {doc.evidenceSnippets[0] && (
                      <SourceCitation
                        evidence={doc.evidenceSnippets[0]}
                        compact
                        onClick={() => onInspectEvidence(doc.evidenceSnippets[0])}
                      />
                    )}
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
              {openAlerts.map((alert) => (
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

              {openAlerts.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    No open discrepancies.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="queries" className="pt-2">
          <ul className="divide-y divide-border">
            {recentQueries.map((q) => (
              <li key={q.id} className="py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-sm font-medium text-foreground">{q.question}</h3>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(q.timestamp).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {q.answer}
                </p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
