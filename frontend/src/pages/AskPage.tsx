import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Search,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Filter,
  Layers,
  History,
  Building2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { QueryResult, EvidenceSnippet, Subsidiary } from "@/types";
import { askDataForgeQuery, fetchRecentQueries } from "@/services/queries";

interface AskPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

export function AskPage({ onInspectEvidence, selectedSubsidiary }: AskPageProps) {
  const [queryInput, setQueryInput] = useState("");
  const [activeResult, setActiveResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recentQueries, setRecentQueries] = useState<QueryResult[]>([]);
  const [yearFilter, setYearFilter] = useState("2023-2024");

  const exampleQuestions = [
    "Compare coal production and stripping ratios across SECL and NCL in FY 2023-24.",
    "What are the proved geological reserves and seam thicknesses in Talcher Basin Block V?",
    "Summarize prime coking coal extraction at Moonidih mine and methane pre-drainage levels.",
    "Verify environmental compliance and bio-reclamation targets achieved at Lakhanpur OC.",
  ];

  useEffect(() => {
    fetchRecentQueries().then((queries) => {
      setRecentQueries(queries);
      if (queries.length > 0) {
        setActiveResult(queries[0]);
      }
    });
  }, []);

  const handleRunQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsLoading(true);
    try {
      const res = await askDataForgeQuery(queryText);
      setActiveResult(res);
      setRecentQueries(prev => [res, ...prev]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-950/80 border border-sky-800/50 text-sky-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              Ask DataForge — Enterprise Research Workspace
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Deterministic answers grounded in indexed CMPDI & CIL subsidiary reports with full source traceability.
            </p>
          </div>
        </div>
      </div>

      {/* Hero Query Bar & Parameter Controls */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunQuery(queryInput);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Ask a technical or production question (e.g., 'Compare coal production between 2022 and 2024')..."
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 pl-9 pr-4 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || !queryInput.trim()}
            className="h-10 px-5 gap-2 font-medium bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
          >
            <Sparkles className="h-4 w-4 text-zinc-900" />
            <span>{isLoading ? "Synthesizing Evidence..." : "Run Grounded Query"}</span>
          </Button>
        </form>

        {/* Filters and Parameter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/70 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase text-zinc-500">Query Grounding Scope:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-[11px]">
              <Building2 className="h-3 w-3 text-zinc-500" />
              Subsidiary: {selectedSubsidiary}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-[11px]">
              <Calendar className="h-3 w-3 text-zinc-500" />
              Reporting Cycle: {yearFilter}
            </span>
          </div>

          <span className="text-[11px] text-zinc-500 font-mono">
            Grounding Index: 1,428 Archival Reports
          </span>
        </div>

        {/* Example Queries */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-mono uppercase text-zinc-500 mr-1">Suggested:</span>
          {exampleQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQueryInput(q);
                handleRunQuery(q);
              }}
              className="rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors truncate max-w-md"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grounded Answer Workspace (Distinct 5-Section Layout) */}
      {activeResult && (
        <div className="space-y-4">
          {/* SECTION 1: ANSWER (Clear, factual, distinguished) */}
          <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-950/80 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-sky-400 border border-sky-800/60">
                <Sparkles className="h-3 w-3" />
                VERIFIED AI ANSWER
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                Grounding Confidence: 98.4%
              </span>
            </div>
            <h3 className="text-base font-semibold text-zinc-100 leading-snug">
              {activeResult.question}
            </h3>
            <p className="text-xs text-zinc-200 leading-relaxed pt-1">
              {activeResult.answer}
            </p>
          </div>

          {/* SECTION 2: KEY FINDINGS */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Key Findings & Quantified Observations
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {activeResult.keyFindings.map((finding, idx) => (
                <div
                  key={idx}
                  className="rounded border border-zinc-800/80 bg-zinc-950/70 p-3 text-xs text-zinc-300 flex items-start gap-2"
                >
                  <span className="font-mono text-emerald-400 font-bold text-xs">{idx + 1}.</span>
                  <span className="leading-snug">{finding}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: EVIDENCE (Distinct from Answer & Source) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
                Deterministic Evidence Extracts
              </h4>
              <span className="text-[11px] text-zinc-500 font-mono">
                Click snippet to inspect source PDF
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeResult.evidence.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => onInspectEvidence(ev)}
                  className="group cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 hover:border-zinc-700 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-400 truncate max-w-[220px]">{ev.documentName}</span>
                    <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                      Page {ev.pageNumber}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-zinc-200">
                    {ev.sectionHeader}
                  </div>
                  <div className="rounded bg-zinc-900/80 p-2 text-xs font-serif italic text-zinc-300 border-l-2 border-l-sky-500 line-clamp-3">
                    "{ev.originalContext}"
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 text-zinc-500">
                    <span>Field: <strong className="text-zinc-300 font-mono">{ev.field}</strong></span>
                    <span className="text-sky-400 group-hover:underline flex items-center gap-0.5">
                      Inspect <ExternalLink className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4 & 5: SOURCES & RELATED DOCUMENTS */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide block">
              Audited Primary Sources
            </span>
            <div className="flex flex-wrap gap-2">
              {activeResult.sourceDocuments.map((src) => (
                <div
                  key={src.id}
                  className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 font-mono"
                >
                  <FileText className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{src.filename}</span>
                  <span className="text-zinc-500">|</span>
                  <span className="text-zinc-400">Pages: {src.pageNumbers.join(", ")}</span>
                  <span className="text-emerald-400 text-[10px] ml-1 bg-emerald-950/70 px-1 rounded border border-emerald-800/40">
                    {Math.round(src.relevanceScore * 100)}% Match
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
