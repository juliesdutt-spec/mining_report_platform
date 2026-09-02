import React, { useState } from "react";
import {
  FileSpreadsheet,
  Sparkles,
  Download,
  Printer,
  CheckSquare,
  Square,
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Eye,
  Sliders,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Subsidiary } from "@/types";

interface ReportStudioPageProps {
  selectedSubsidiary: Subsidiary | "ALL";
}

export function ReportStudioPage({ selectedSubsidiary }: ReportStudioPageProps) {
  const [reportType, setReportType] = useState<string>("executive_summary");
  const [reportingPeriod, setReportingPeriod] = useState<string>("FY 2023-2024 (Annual)");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isReportReady, setIsReportReady] = useState<boolean>(true);

  const [selectedSections, setSelectedSections] = useState({
    execSummary: true,
    productionOverview: true,
    keyFindings: true,
    trendAnalysis: true,
    aiInsights: true,
    sourceReferences: true,
  });

  const toggleSection = (key: keyof typeof selectedSections) => {
    setSelectedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setIsReportReady(true);
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            Automated Report Studio
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Automated synthesis of statutory reports, parliamentary dossiers & executive mining summaries from indexed sources.
          </p>
        </div>

        {isReportReady && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-zinc-300">
              <Printer className="h-3.5 w-3.5" />
              <span>Print Preview</span>
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              <span>Export DOCX</span>
            </Button>
            <Button variant="default" size="sm" className="gap-1.5 text-xs bg-zinc-100 text-zinc-950 font-medium">
              <Download className="h-3.5 w-3.5" />
              <span>Download Signed PDF</span>
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Configuration Column (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-zinc-400" />
                <span>Report Parameters</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0 text-xs">
              {/* Report Template Selector */}
              <div>
                <label className="text-zinc-400 font-medium block mb-1.5">Report Template</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full h-8 rounded border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="executive_summary">Executive Mining Production Summary</option>
                  <option value="statutory_audit">Statutory DGMS Safety & Extraction Audit</option>
                  <option value="parliamentary">Parliamentary Inquiry Response Dossier</option>
                  <option value="geological_reserve">CMPDI Geological Exploration Assessment</option>
                </select>
              </div>

              {/* Reporting Period */}
              <div>
                <label className="text-zinc-400 font-medium block mb-1.5">Reporting Period</label>
                <select
                  value={reportingPeriod}
                  onChange={(e) => setReportingPeriod(e.target.value)}
                  className="w-full h-8 rounded border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="FY 2023-2024 (Annual)">FY 2023-2024 (Annual Cycle)</option>
                  <option value="FY 2024-2025 Q1">FY 2024-2025 (Quarter 1)</option>
                  <option value="FY 2024-2025 Q2">FY 2024-2025 (Quarter 2)</option>
                  <option value="Custom Date Range">Custom Audit Interval</option>
                </select>
              </div>

              {/* Included Sections Checklist */}
              <div>
                <label className="text-zinc-400 font-medium block mb-2">Sections to Synthesize</label>
                <div className="space-y-2">
                  {[
                    { key: "execSummary", label: "Executive Summary" },
                    { key: "productionOverview", label: "Production Overview & Metrics" },
                    { key: "keyFindings", label: "Key Findings & Observations" },
                    { key: "trendAnalysis", label: "YoY Trend Analysis & Visuals" },
                    { key: "aiInsights", label: "AI Insights & Risk Anomalies" },
                    { key: "sourceReferences", label: "Deterministic Source References" },
                  ].map((sec) => {
                    const isChecked = selectedSections[sec.key as keyof typeof selectedSections];
                    return (
                      <button
                        key={sec.key}
                        type="button"
                        onClick={() => toggleSection(sec.key as keyof typeof selectedSections)}
                        className="flex items-center gap-2 text-zinc-300 hover:text-white text-xs w-full text-left"
                      >
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-zinc-600 flex-shrink-0" />
                        )}
                        <span>{sec.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate Button */}
              <div className="pt-3 border-t border-zinc-800">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full gap-2 font-medium bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                  <span>{isGenerating ? "Compiling Report..." : "Generate Report"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Synthesized Document Preview Surface (8 cols) */}
        <div className="lg:col-span-8">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-2xl font-serif text-zinc-200">
            {/* Report Header Band */}
            <div className="border-b border-zinc-800 pb-5 font-sans">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-zinc-500 tracking-wider">
                  GOVERNMENT OF INDIA • MINISTRY OF COAL
                </span>
                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  DATAFORGE VERIFIED AUDIT
                </span>
              </div>
              <h2 className="text-lg font-bold text-zinc-100 mt-2">
                EXECUTIVE PRODUCTION & STATUTORY COMPLIANCE DOSSIER
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono mt-1">
                <span>Cycle: {reportingPeriod}</span>
                <span>•</span>
                <span>Subsidiaries: SECL, NCL, BCCL, MCL</span>
                <span>•</span>
                <span>Generated: {new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Section 1: Executive Summary */}
            {selectedSections.execSummary && (
              <div className="space-y-2">
                <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-sky-400">
                  1. Executive Summary
                </h3>
                <p className="text-xs leading-relaxed text-zinc-300">
                  During the evaluated operational timeframe, aggregated raw coal excavation across Coal India Limited subsidiaries reached <strong>773.60 MT</strong>, maintaining an annualized 10.0% trajectory expansion. Mechanized opencast quarries contributed 93.8% of total volume led by SECL Gevra (52.50 MT) and NCL Jayant (25.00 MT). All operations maintained strict compliance with Directorate General of Mines Safety (DGMS) statutory standards with zero fatal incidents logged across automated dispatch silos.
                </p>
              </div>
            )}

            {/* Section 2: Production Overview */}
            {selectedSections.productionOverview && (
              <div className="space-y-2 font-sans">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  2. Production Overview & Volumetric Audit
                </h3>
                <div className="rounded border border-zinc-800 bg-zinc-900/50 overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="border-b border-zinc-800 text-[10px] uppercase text-zinc-500 bg-zinc-950/60">
                      <tr>
                        <th className="p-2">Subsidiary</th>
                        <th className="p-2">Lead Mine</th>
                        <th className="p-2">Actual (MT)</th>
                        <th className="p-2">Target (MT)</th>
                        <th className="p-2">Stripping Ratio</th>
                        <th className="p-2">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      <tr>
                        <td className="p-2 font-semibold text-emerald-400">SECL</td>
                        <td className="p-2">Gevra OC</td>
                        <td className="p-2">52.50 MT</td>
                        <td className="p-2">50.00 MT</td>
                        <td className="p-2">1:1.18</td>
                        <td className="p-2 text-emerald-400">Validated (100%)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold text-emerald-400">NCL</td>
                        <td className="p-2">Jayant OC</td>
                        <td className="p-2">25.00 MT</td>
                        <td className="p-2">25.00 MT</td>
                        <td className="p-2">1:2.05</td>
                        <td className="p-2 text-amber-400">Weighbridge Check</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold text-emerald-400">BCCL</td>
                        <td className="p-2">Moonidih UG</td>
                        <td className="p-2">1.42 MT</td>
                        <td className="p-2">1.50 MT</td>
                        <td className="p-2">N/A (Underground)</td>
                        <td className="p-2 text-emerald-400">Validated (100%)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Section 3: Key Findings */}
            {selectedSections.keyFindings && (
              <div className="space-y-2">
                <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-sky-400">
                  3. Key Observations & Statutory Findings
                </h3>
                <ul className="list-disc list-inside text-xs leading-relaxed text-zinc-300 space-y-1">
                  <li>First-Mile Connectivity (FMC) rapid-loading systems successfully eliminated 1,200 truck trips per day at Jayant Project.</li>
                  <li>BCCL Longwall face degasification maintained roadway methane levels reliably below 0.3% threshold.</li>
                  <li>Overburden removal ratio across SECL opencast mines remained favorable at 1.18 m³/t against a 1.25 ceiling limit.</li>
                </ul>
              </div>
            )}

            {/* Section 4: AI Insights */}
            {selectedSections.aiInsights && (
              <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-1.5 font-sans">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Predictive Anomaly Detection</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Historical telemetry detects a 1.5% reconciliation discrepancy between bunker weighbridge readouts and rakes dispatch manifests during peak monsoon intervals. Recommended automated cross-verification with Indian Railways FOIS telemetry.
                </p>
              </div>
            )}

            {/* Section 5: Source References */}
            {selectedSections.sourceReferences && (
              <div className="border-t border-zinc-800 pt-4 font-sans text-xs text-zinc-500 space-y-1">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-zinc-400 block">
                  Grounding Lineage
                </span>
                <p className="font-mono text-[11px]">
                  Synthesized deterministically from SECL_Gevra_Annual_Production_2023_24.pdf (p.14), NCL_Jayant_Expansion_Review_FY24.pdf (p.19), BCCL_Jharia_Seam_XVI_Geological_Survey.pdf (p.38).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
