import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Sliders,
  ExternalLink,
  GitCompare,
  ArrowRight,
  Filter,
  Check,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ValidationItem, EvidenceSnippet, Subsidiary } from "@/types";
import { fetchValidationItems, markItemValidated } from "@/services/validation";

interface ValidationPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

export function ValidationPage({ onInspectEvidence, selectedSubsidiary }: ValidationPageProps) {
  const [items, setItems] = useState<ValidationItem[]>([]);
  const [activeItem, setActiveItem] = useState<ValidationItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("all");

  useEffect(() => {
    fetchValidationItems().then((res) => {
      setItems(res);
      if (res.length > 0) {
        setActiveItem(res[0]);
      }
    });
  }, []);

  const handleResolve = async (id: string, note: string) => {
    const updated = await markItemValidated(id, note);
    setItems(updated);
    const curr = updated.find(i => i.id === id);
    if (curr) setActiveItem(curr);
  };

  const filtered = items.filter(item => {
    const matchesSub = selectedSubsidiary === "ALL" || item.subsidiary === selectedSubsidiary;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSub && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            Validation & Source Traceability Center
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/50">
              Audit Differentiator
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Detect conflicting figures across subsidiary ledgers, low-confidence OCR and missing data with source verification.
          </p>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-md border border-zinc-800 text-xs">
          {(["all", "pending", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`capitalize px-2.5 py-1 rounded transition-colors text-[11px] ${
                statusFilter === s
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s} ({s === "all" ? items.length : items.filter(i => i.status === s).length})
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-500 block">Total Audited Records</span>
            <span className="text-lg font-bold font-mono text-zinc-200">94,620</span>
          </div>
          <ShieldCheck className="h-6 w-6 text-emerald-400 opacity-80" />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-500 block">Verified Compliance Rate</span>
            <span className="text-lg font-bold font-mono text-emerald-400">98.6%</span>
          </div>
          <CheckCircle2 className="h-6 w-6 text-emerald-400 opacity-80" />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-500 block">Active Value Conflicts</span>
            <span className="text-lg font-bold font-mono text-rose-400">1 Conflict</span>
          </div>
          <GitCompare className="h-6 w-6 text-rose-400 opacity-80" />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-500 block">Low Confidence Scans</span>
            <span className="text-lg font-bold font-mono text-amber-400">1 Warning</span>
          </div>
          <AlertTriangle className="h-6 w-6 text-amber-400 opacity-80" />
        </div>
      </div>

      {/* Split Audit Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Discrepancy Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
            <span>Discrepancy Triage Queue</span>
            <span className="font-mono text-zinc-500">{filtered.length} items</span>
          </div>

          <div className="space-y-2.5">
            {filtered.map((item) => {
              const isSelected = activeItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveItem(item)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-zinc-800/90 border-zinc-700 text-zinc-100 shadow-md"
                      : "bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                      {item.subsidiary} • {item.mineName}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        item.status === "resolved"
                          ? "bg-emerald-950/70 text-emerald-400 border border-emerald-800/40"
                          : "bg-rose-950/70 text-rose-400 border border-rose-800/40"
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-zinc-200 mt-2 truncate">
                    {item.title}
                  </h4>

                  <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                    <span>Field:</span>
                    <strong className="font-mono text-zinc-300">{item.fieldName}</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Side-by-Side Dual Source Comparison (7 cols) */}
        <div className="lg:col-span-7">
          {activeItem ? (
            <Card className="border-zinc-800 bg-zinc-900/50 space-y-4">
              <CardHeader className="border-b border-zinc-800/80 pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-zinc-500">
                    Dual Source Comparator & Lineage Resolution
                  </span>
                  <span className="font-mono text-xs text-zinc-400">
                    ID: {activeItem.id}
                  </span>
                </div>
                <CardTitle className="text-sm font-bold text-zinc-100 mt-1">
                  {activeItem.title}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Target Field: <code className="font-mono text-zinc-200">{activeItem.fieldName}</code> across {activeItem.subsidiary} archival repositories.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 pt-0">
                {/* Side-by-side sources */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Source A */}
                  <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase text-amber-400 font-bold">
                        Source A (Annual Review)
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {Math.round(activeItem.sourceA.confidence * 100)}% Conf
                      </span>
                    </div>

                    <div className="text-xl font-bold font-mono text-amber-300 py-1">
                      {activeItem.sourceA.value}
                    </div>

                    <div className="text-xs text-zinc-400 space-y-1 font-mono text-[11px] pt-1 border-t border-amber-900/40">
                      <div className="truncate text-zinc-300">{activeItem.sourceA.documentName}</div>
                      <div>Page Reference: Page {activeItem.sourceA.pageNumber}</div>
                    </div>
                  </div>

                  {/* Source B */}
                  {activeItem.sourceB ? (
                    <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase text-emerald-400 font-bold">
                          Source B (Dispatch Ledger)
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {Math.round(activeItem.sourceB.confidence * 100)}% Conf
                        </span>
                      </div>

                      <div className="text-xl font-bold font-mono text-emerald-300 py-1">
                        {activeItem.sourceB.value}
                      </div>

                      <div className="text-xs text-zinc-400 space-y-1 font-mono text-[11px] pt-1 border-t border-emerald-900/40">
                        <div className="truncate text-zinc-300">{activeItem.sourceB.documentName}</div>
                        <div>Page Reference: Page {activeItem.sourceB.pageNumber}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 flex items-center justify-center text-xs text-zinc-500">
                      No conflicting secondary source detected. Warning caused by OCR quality threshold.
                    </div>
                  )}
                </div>

                {/* Audit Explanation */}
                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300 leading-relaxed">
                  <span className="font-bold text-zinc-200 block mb-1">Auditor Reconciliation Protocol:</span>
                  Discrepancy stems from a 0.38 MT variation between the Annual Review (25.00 MT target milestone) and the Subsidiary Dispatch Ledger (24.62 MT net railway weighbridge tickets). Recommended resolution is to validate against the official railway weighbridge dispatch ledger.
                </div>

                {/* Resolution Status */}
                {activeItem.status === "resolved" ? (
                  <div className="rounded-md border border-emerald-800/80 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>{activeItem.resolutionNote || "Marked validated by official auditor."}</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolve(activeItem.id, "Flagged for manual physical audit by CMPDI Regional Institute")}
                      className="text-xs text-zinc-400"
                    >
                      Flag for Site Inspection
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResolve(activeItem.id, "Reconciled with Dispatch Ledger (24.62 MT) as statutory definitive figure")}
                        className="text-xs"
                      >
                        Adopt Source B (24.62 MT)
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleResolve(activeItem.id, "Validated 25.00 MT production based on gross pithead excavation")}
                        className="text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Mark Validated
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 text-center text-xs text-zinc-500">
              Select an item to view dual source traceability.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
