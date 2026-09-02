import React, { useState } from "react";
import {
  Database,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MiningDocument, EvidenceSnippet, Subsidiary } from "@/types";
import { MOCK_DOCUMENTS } from "@/services/mockData";

interface DataExplorerPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

export function DataExplorerPage({ onInspectEvidence, selectedSubsidiary }: DataExplorerPageProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("mineName");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterMethod, setFilterMethod] = useState<string>("all");

  const [visibleColumns, setVisibleColumns] = useState({
    mine: true,
    subsidiary: true,
    production: true,
    method: true,
    mineral: true,
    reserves: true,
    confidence: true,
    status: true,
    source: true,
  });

  const rawRecords = [
    {
      id: "rec-1",
      mineName: "Gevra OC Mega Project",
      subsidiary: "SECL",
      year: "2023-24",
      production: "52.50 MT",
      productionNum: 52.5,
      method: "Opencast",
      mineral: "Non-Coking Coal (G11)",
      reserves: "410.20 MT",
      sourceDoc: "SECL_Gevra_Annual_Production_2023_24.pdf",
      page: 14,
      confidence: 0.99,
      status: "validated" as const,
      evidenceSnippet: MOCK_DOCUMENTS[0].evidenceSnippets[0]
    },
    {
      id: "rec-2",
      mineName: "Moonidih Underground Mine",
      subsidiary: "BCCL",
      year: "2023-24",
      production: "1.42 MT",
      productionNum: 1.42,
      method: "Underground",
      mineral: "Prime Coking (W-II)",
      reserves: "88.40 MT",
      sourceDoc: "BCCL_Jharia_Seam_XVI_Geological_Survey.pdf",
      page: 38,
      confidence: 0.98,
      status: "validated" as const,
      evidenceSnippet: MOCK_DOCUMENTS[1].evidenceSnippets[0]
    },
    {
      id: "rec-3",
      mineName: "Talcher Basin Regional Block V",
      subsidiary: "CMPDI",
      year: "2023-24",
      production: "Proved Stage",
      productionNum: 0,
      method: "Opencast",
      mineral: "Thermal (G12-G14)",
      reserves: "1,240.00 MT",
      sourceDoc: "CMPDI_Exploration_Talcher_Basin_Block_V.pdf",
      page: 52,
      confidence: 0.94,
      status: "needs_review" as const,
      evidenceSnippet: MOCK_DOCUMENTS[2].evidenceSnippets[0]
    },
    {
      id: "rec-4",
      mineName: "Jayant Opencast Project",
      subsidiary: "NCL",
      year: "2023-24",
      production: "25.00 MT",
      productionNum: 25.0,
      method: "Opencast",
      mineral: "Non-Coking Coal (G8)",
      reserves: "295.10 MT",
      sourceDoc: "NCL_Jayant_Expansion_Review_FY24.pdf",
      page: 19,
      confidence: 0.89,
      status: "conflicting" as const,
      evidenceSnippet: MOCK_DOCUMENTS[3].evidenceSnippets[0]
    },
    {
      id: "rec-5",
      mineName: "Lakhanpur Opencast Mine",
      subsidiary: "MCL",
      year: "2023-24",
      production: "21.80 MT",
      productionNum: 21.8,
      method: "Opencast",
      mineral: "Thermal Coal (G13)",
      reserves: "182.00 MT",
      sourceDoc: "MCL_Lakhanpur_Environmental_Audit_2024.docx",
      page: 11,
      confidence: 0.98,
      status: "validated" as const,
      evidenceSnippet: MOCK_DOCUMENTS[4].evidenceSnippets[0]
    }
  ];

  const filtered = rawRecords.filter(item => {
    const matchesSub = selectedSubsidiary === "ALL" || item.subsidiary === selectedSubsidiary;
    const matchesMethod = filterMethod === "all" || item.method.toLowerCase() === filterMethod.toLowerCase();
    const matchesSearch = item.mineName.toLowerCase().includes(search.toLowerCase()) ||
                          item.mineral.toLowerCase().includes(search.toLowerCase()) ||
                          item.sourceDoc.toLowerCase().includes(search.toLowerCase());
    return matchesSub && matchesMethod && matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = (a as any)[sortField];
    let valB = (b as any)[sortField];
    if (typeof valA === "string") {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            Structured Data Explorer
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Query and filter extracted tabular entities with deterministic line-level source provenance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-zinc-300">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Customize Columns</span>
          </Button>
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search mine, mineral, or document..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-zinc-950"
          />
        </div>

        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <span className="text-zinc-500 font-mono text-[11px]">Method:</span>
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="h-8 rounded border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-300 focus:outline-none"
          >
            <option value="all">All Methods</option>
            <option value="opencast">Opencast</option>
            <option value="underground">Underground</option>
          </select>
          <span className="text-[11px] text-zinc-500 font-mono ml-2">
            Showing {sorted.length} records
          </span>
        </div>
      </div>

      {/* TanStack-style Structured Grid */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/70 text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
              <tr>
                {visibleColumns.mine && (
                  <th onClick={() => handleSort("mineName")} className="px-4 py-3 font-medium cursor-pointer hover:text-zinc-200">
                    <div className="flex items-center gap-1">
                      <span>Mine Project</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                )}
                {visibleColumns.subsidiary && (
                  <th onClick={() => handleSort("subsidiary")} className="px-4 py-3 font-medium cursor-pointer hover:text-zinc-200">
                    <div className="flex items-center gap-1">
                      <span>Subsidiary</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                )}
                {visibleColumns.production && (
                  <th onClick={() => handleSort("productionNum")} className="px-4 py-3 font-medium cursor-pointer hover:text-zinc-200">
                    <div className="flex items-center gap-1">
                      <span>Production</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                )}
                {visibleColumns.method && <th className="px-4 py-3 font-medium">Method</th>}
                {visibleColumns.mineral && <th className="px-4 py-3 font-medium">Mineral Classification</th>}
                {visibleColumns.reserves && <th className="px-4 py-3 font-medium">Proved Reserves</th>}
                {visibleColumns.confidence && <th className="px-4 py-3 font-medium">Confidence</th>}
                {visibleColumns.status && <th className="px-4 py-3 font-medium">Validation</th>}
                {visibleColumns.source && <th className="px-4 py-3 text-right font-medium">Grounded Source</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {sorted.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onInspectEvidence(row.evidenceSnippet)}
                  className="hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                >
                  {visibleColumns.mine && (
                    <td className="px-4 py-3 font-medium text-zinc-100 group-hover:text-white">
                      {row.mineName}
                    </td>
                  )}
                  {visibleColumns.subsidiary && (
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-400">
                      {row.subsidiary}
                    </td>
                  )}
                  {visibleColumns.production && (
                    <td className="px-4 py-3 font-mono font-bold text-zinc-200">
                      {row.production}
                    </td>
                  )}
                  {visibleColumns.method && (
                    <td className="px-4 py-3 text-zinc-400">
                      {row.method}
                    </td>
                  )}
                  {visibleColumns.mineral && (
                    <td className="px-4 py-3 text-zinc-300">
                      {row.mineral}
                    </td>
                  )}
                  {visibleColumns.reserves && (
                    <td className="px-4 py-3 font-mono text-zinc-400">
                      {row.reserves}
                    </td>
                  )}
                  {visibleColumns.confidence && (
                    <td className="px-4 py-3 font-mono">
                      <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 text-[11px]">
                        {Math.round(row.confidence * 100)}%
                      </span>
                    </td>
                  )}
                  {visibleColumns.status && (
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  )}
                  {visibleColumns.source && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-400 group-hover:text-zinc-200">
                        <FileText className="h-3 w-3 text-zinc-500" />
                        <span className="truncate max-w-[140px]">{row.sourceDoc}</span>
                        <span className="text-zinc-600">:p.{row.page}</span>
                        <ExternalLink className="h-3 w-3 text-zinc-500 ml-1" />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-400">
          <span>Row 1 to {sorted.length} of {sorted.length} records</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled className="h-7 w-7 p-0">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-mono text-zinc-200">1</span>
            <Button variant="outline" size="sm" disabled className="h-7 w-7 p-0">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
