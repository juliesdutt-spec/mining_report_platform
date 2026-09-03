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
import { fetchKpiMetrics, fetchProductionTrends } from "@/services/analytics";
import { fetchDocuments } from "@/services/documents";
import { fetchValidationItems } from "@/services/validation";
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
  const [kpiData, setKpiData] = useState<KpiMetrics | null>(null);
  const [trendInterval, setTrendInterval] = useState<"3m" | "30d" | "7d">("3m");
  const [trendData, setTrendData] = useState<ProductionDataPoint[]>([]);
  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [validationAlerts, setValidationAlerts] = useState<ValidationItem[]>([]);
  const [recentQueries, setRecentQueries] = useState<QueryResult[]>([]);
  const colors = useChartColors();

  useEffect(() => {
    fetchKpiMetrics().then(setKpiData);
    fetchDocuments().then(setDocuments);
    fetchValidationItems().then(setValidationAlerts);
    fetchRecentQueries().then(setRecentQueries);
  }, []);

  useEffect(() => {
    fetchProductionTrends(trendInterval).then(setTrendData);
  }, [trendInterval]);

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
      <StatGroup>
        <Stat
          label="Automation rate"
          value={`${kpiData?.automationRate ?? 94.2}%`}
          delta="+3.8%"
          deltaType="positive"
          hint="Against an 80% target"
        />
        <Stat
          label="Extraction accuracy"
          value={`${kpiData?.extractionAccuracy ?? 98.6}%`}
          delta="+0.4%"
          deltaType="positive"
          hint="Verified by CMPDI auditors"
        />
        <Stat
          label="Documents ingested"
          value={(kpiData?.documentsProcessed ?? 1428).toLocaleString("en-IN")}
          delta="+12.5%"
          deltaType="positive"
          hint={`${(kpiData?.pagesProcessed ?? 28410).toLocaleString("en-IN")} pages indexed`}
        />
        <Stat
          label="Open discrepancies"
          value={openAlerts.length}
          tone={openAlerts.length > 0 ? "warning" : "success"}
          hint="Awaiting auditor triage"
        />
      </StatGroup>

      {/* Production trend — a chart genuinely benefits from containment */}
      <Section
        title="Production against target"
        description="Actual output versus statutory planned target, in million tonnes."
        actions={
          <Tabs value={trendInterval} onValueChange={(v) => setTrendInterval(v as typeof trendInterval)}>
            <TabsList>
              <TabsTrigger value="3m">3 months</TabsTrigger>
              <TabsTrigger value="30d">30 days</TabsTrigger>
              <TabsTrigger value="7d">7 days</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={colors.border} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={colors["muted-foreground"]}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={colors["muted-foreground"]}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip {...tooltipStyle(colors)} />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="Actual (MT)"
                  stroke={colors.primary}
                  strokeWidth={2}
                  fill={colors.primary}
                  fillOpacity={0.08}
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  name="Target (MT)"
                  stroke={colors.teal}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded" style={{ backgroundColor: colors.primary }} />
                Actual output
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded" style={{ backgroundColor: colors.teal }} />
                Planned target
              </span>
            </div>
            <button
              onClick={() => onNavigate("analytics")}
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Full analytics
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </Section>

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
                    <StatusBadge status={doc.validationStatus} />
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
                      {alert.subsidiary} · {alert.mineName}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {alert.fieldName}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-warning">
                    {alert.sourceA.value}
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
