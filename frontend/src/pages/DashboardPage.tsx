import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  Database,
  Search,
  ExternalLink,
  Bot
} from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  KpiMetrics,
  MiningDocument,
  ProductionDataPoint,
  ValidationItem,
  QueryResult,
  EvidenceSnippet,
  NavigationTab,
  Subsidiary
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
  const [activeTableTab, setActiveTableTab] = useState<"documents" | "alerts" | "queries">("documents");

  useEffect(() => {
    fetchKpiMetrics().then(setKpiData);
    fetchDocuments().then(setDocuments);
    fetchValidationItems().then(setValidationAlerts);
    fetchRecentQueries().then(setRecentQueries);
  }, []);

  useEffect(() => {
    fetchProductionTrends(trendInterval).then(setTrendData);
  }, [trendInterval]);

  // Filter documents by subsidiary if one is selected
  const filteredDocs = selectedSubsidiary === "ALL"
    ? documents
    : documents.filter(d => d.subsidiary === selectedSubsidiary);

  return (
    <div className="space-y-6">
      {/* Top Banner / Operational Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            Operational Intelligence Console
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Live Pipeline
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            CMPDI / Coal India Limited AI ingestion pipeline • Automated extraction, cross-subsidiary validation & query synthesis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("ask")}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            <span>Ask DataForge</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onNavigate("documents")}
            className="gap-1.5 text-xs"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Ingest Document</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid (Ref: Screenshot 4 top row) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Tier 1 Primary Hero KPIs */}
        <KpiCard
          title="Automation Rate"
          value={`${kpiData?.automationRate ?? 94.2}%`}
          delta="+3.8%"
          deltaType="positive"
          subtitleTop="Manual effort reduction"
          subtitleBottom="80% target achieved"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        />
        <KpiCard
          title="Extraction Accuracy"
          value={`${kpiData?.extractionAccuracy ?? 98.6}%`}
          delta="+0.4%"
          deltaType="positive"
          subtitleTop="Verified by CMPDI auditors"
          subtitleBottom="Strict entity grounding"
          icon={<Sparkles className="h-4 w-4 text-sky-400" />}
        />
        <KpiCard
          title="Documents Ingested"
          value={kpiData?.documentsProcessed ?? 1428}
          delta="+12.5%"
          deltaType="positive"
          subtitleTop="Across 8 CIL subsidiaries"
          subtitleBottom={`${kpiData?.pagesProcessed ?? 28410} pages indexed`}
          icon={<FileText className="h-4 w-4 text-zinc-400" />}
        />
        <KpiCard
          title="Turnaround Time Saved"
          value={`${kpiData?.processingTimeSavedHours ?? 84.5} hrs`}
          delta="-82%"
          deltaType="positive"
          subtitleTop="Turnaround: weeks → minutes"
          subtitleBottom="Direct parliamentary speedup"
          icon={<Clock className="h-4 w-4 text-amber-400" />}
        />
      </div>

      {/* Secondary Compact Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-zinc-400">Records Extracted</span>
          <span className="font-mono font-semibold text-zinc-200">{kpiData?.recordsExtracted.toLocaleString() ?? "94,620"}</span>
        </div>
        <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-zinc-400">Reports Generated</span>
          <span className="font-mono font-semibold text-zinc-200">{kpiData?.reportsGenerated ?? 412} synthesized</span>
        </div>
        <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-zinc-400">Queries Answered</span>
          <span className="font-mono font-semibold text-zinc-200">{kpiData?.queriesAnswered.toLocaleString() ?? "3,890"} queries</span>
        </div>
        <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-zinc-400">Active Validation Alerts</span>
          <span className="font-mono font-semibold text-rose-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {validationAlerts.filter(a => a.status === 'pending').length} discrepancies
          </span>
        </div>
      </div>

      {/* Main Analytics Area Chart (Ref: Screenshot 4 "Total Visitors / Area Chart with filter tabs") */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <span>Subsidiary Coal Production & Extraction Velocity</span>
              <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                Million Tonnes (MT)
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Historical actual production vs. statutory planned target across opencast & underground mines.
            </CardDescription>
          </div>

          {/* Time Interval Selector (Ref: Screenshot 4 "Last 3 months | Last 30 days | Last 7 days") */}
          <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-950 p-0.5 text-xs">
            <button
              onClick={() => setTrendInterval("3m")}
              className={`rounded px-2.5 py-1 transition-colors ${
                trendInterval === "3m"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Last 3 months
            </button>
            <button
              onClick={() => setTrendInterval("30d")}
              className={`rounded px-2.5 py-1 transition-colors ${
                trendInterval === "30d"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Last 30 days
            </button>
            <button
              onClick={() => setTrendInterval("7d")}
              className={`rounded px-2.5 py-1 transition-colors ${
                trendInterval === "7d"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Last 7 days
            </button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#09090b",
                    borderColor: "#27272a",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#f4f4f5",
                  }}
                  itemStyle={{ color: "#f4f4f5" }}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="Actual Output (MT)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorActual)"
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  name="Planned Target (MT)"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorTarget)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Actual Output (Million Tonnes)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Planned Ministry Target
              </span>
            </div>
            <button
              onClick={() => onNavigate("analytics")}
              className="flex items-center gap-1 text-zinc-300 hover:text-white transition-colors"
            >
              <span>Explore full analytical breakdown</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Operational Table & Audit Area (Ref: Screenshot 4 bottom table section) */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 px-4 py-3 gap-2">
          {/* Table Tab Selector (Ref: Screenshot 4 "Outline | Past Performance | Focus Documents") */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-md border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTableTab("documents")}
              className={`rounded px-2.5 py-1 transition-colors flex items-center gap-1.5 ${
                activeTableTab === "documents"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span>Recent Ingested Documents</span>
              <span className="font-mono text-[10px] text-zinc-500">({filteredDocs.length})</span>
            </button>
            <button
              onClick={() => setActiveTableTab("alerts")}
              className={`rounded px-2.5 py-1 transition-colors flex items-center gap-1.5 ${
                activeTableTab === "alerts"
                  ? "bg-zinc-800 text-rose-400 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Validation Alerts</span>
              <span className="font-mono text-[10px] text-rose-400">
                ({validationAlerts.filter(a => a.status === "pending").length})
              </span>
            </button>
            <button
              onClick={() => setActiveTableTab("queries")}
              className={`rounded px-2.5 py-1 transition-colors flex items-center gap-1.5 ${
                activeTableTab === "queries"
                  ? "bg-zinc-800 text-sky-400 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>Recent Grounded Queries</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("explorer")}
              className="text-xs gap-1"
            >
              <Database className="h-3.5 w-3.5 text-zinc-400" />
              <span>Open Data Explorer</span>
            </Button>
          </div>
        </div>

        {/* Tab 1: Documents Table */}
        {activeTableTab === "documents" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-950/40 text-[11px] uppercase tracking-wider text-zinc-500 font-mono">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Document / File</th>
                  <th className="px-4 py-2.5 font-medium">Subsidiary</th>
                  <th className="px-4 py-2.5 font-medium">Mine / Area</th>
                  <th className="px-4 py-2.5 font-medium">Extracted Output</th>
                  <th className="px-4 py-2.5 font-medium">Extraction Confidence</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Traceability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      if (doc.evidenceSnippets[0]) {
                        onInspectEvidence(doc.evidenceSnippets[0]);
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 text-zinc-400 group-hover:text-zinc-200" />
                        <div>
                          <div className="font-medium text-zinc-200 group-hover:text-white truncate max-w-xs">
                            {doc.filename}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {doc.fileType} • {doc.pageCount} pages • {(doc.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-zinc-300 font-medium">
                        {doc.subsidiary}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {doc.mineName}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-emerald-400">
                      {doc.quantityExtracted}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${Math.round(doc.confidenceScore * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-zinc-400">
                          {Math.round(doc.confidenceScore * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.validationStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (doc.evidenceSnippets[0]) {
                            onInspectEvidence(doc.evidenceSnippets[0]);
                          }
                        }}
                        className="h-7 text-[11px] gap-1 text-zinc-400 hover:text-white"
                      >
                        <span>Evidence</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Validation Alerts */}
        {activeTableTab === "alerts" && (
          <div className="p-4 space-y-3">
            {validationAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60 px-2 py-0.5 text-[11px] font-mono font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {alert.type.toUpperCase()} DISCREPANCY
                    </span>
                    <span className="font-mono text-xs text-zinc-400">{alert.subsidiary} • {alert.mineName}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-200">{alert.title}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="rounded border border-zinc-800 bg-zinc-900 p-2">
                      <span className="text-[10px] text-zinc-500 font-mono block">SOURCE A: {alert.sourceA.documentName}</span>
                      <span className="text-sm font-bold font-mono text-amber-400">{alert.sourceA.value}</span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">Page {alert.sourceA.pageNumber} • Conf: {Math.round(alert.sourceA.confidence * 100)}%</span>
                    </div>
                    {alert.sourceB && (
                      <div className="rounded border border-zinc-800 bg-zinc-900 p-2">
                        <span className="text-[10px] text-zinc-500 font-mono block">SOURCE B: {alert.sourceB.documentName}</span>
                        <span className="text-sm font-bold font-mono text-emerald-400">{alert.sourceB.value}</span>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">Page {alert.sourceB.pageNumber} • Conf: {Math.round(alert.sourceB.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate("validation")}
                    className="text-xs"
                  >
                    Compare Sources
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onNavigate("validation")}
                    className="text-xs"
                  >
                    Triage Discrepancy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Recent AI Queries */}
        {activeTableTab === "queries" && (
          <div className="p-4 space-y-3">
            {recentQueries.map((q) => (
              <div
                key={q.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-semibold text-zinc-200">{q.question}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{new Date(q.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed border-l-2 border-zinc-700 pl-3 py-1">
                  {q.answer}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono">Evidence Trace:</span>
                  {q.evidence.map((ev) => (
                    <SourceCitation
                      key={ev.id}
                      evidence={ev}
                      onClick={() => onInspectEvidence(ev)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
