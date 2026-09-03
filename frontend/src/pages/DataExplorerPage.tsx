import React, { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceMeter } from "@/components/shared/ConfidenceMeter";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { cn } from "@/lib/utils";
import { EvidenceSnippet, Subsidiary } from "@/types";
import { MOCK_DOCUMENTS } from "@/services/mockData";

interface DataExplorerPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

const RECORDS = [
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
    confidence: 0.99,
    status: "validated" as const,
    evidenceSnippet: MOCK_DOCUMENTS[0].evidenceSnippets[0],
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
    confidence: 0.98,
    status: "validated" as const,
    evidenceSnippet: MOCK_DOCUMENTS[1].evidenceSnippets[0],
  },
  {
    id: "rec-3",
    mineName: "Talcher Basin Regional Block V",
    subsidiary: "CMPDI",
    year: "2023-24",
    production: "Proved stage",
    productionNum: 0,
    method: "Opencast",
    mineral: "Thermal (G12-G14)",
    reserves: "1,240.00 MT",
    confidence: 0.94,
    status: "needs_review" as const,
    evidenceSnippet: MOCK_DOCUMENTS[2].evidenceSnippets[0],
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
    confidence: 0.89,
    status: "conflicting" as const,
    evidenceSnippet: MOCK_DOCUMENTS[3].evidenceSnippets[0],
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
    confidence: 0.98,
    status: "validated" as const,
    evidenceSnippet: MOCK_DOCUMENTS[4].evidenceSnippets[0],
  },
];

type SortField = "mineName" | "subsidiary" | "productionNum" | "confidence";

/** Sortable column head — the arrow only appears on the active column. */
function SortableHead({
  field,
  label,
  sortField,
  sortAsc,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortAsc: boolean;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const isActive = sortField === field;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        {isActive &&
          (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );
}

export function DataExplorerPage({ onInspectEvidence, selectedSubsidiary }: DataExplorerPageProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("mineName");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterMethod, setFilterMethod] = useState<string>("all");

  const filtered = RECORDS.filter((item) => {
    const matchesSub = selectedSubsidiary === "ALL" || item.subsidiary === selectedSubsidiary;
    const matchesMethod = filterMethod === "all" || item.method.toLowerCase() === filterMethod;
    const q = search.toLowerCase();
    const matchesSearch =
      item.mineName.toLowerCase().includes(q) || item.mineral.toLowerCase().includes(q);
    return matchesSub && matchesMethod && matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === "string" && typeof valB === "string") {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc
      ? Number(valA) - Number(valB)
      : Number(valB) - Number(valA);
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Explorer"
        description="Extracted tabular records with line-level provenance. Every row resolves to a page in its source document."
        actions={
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      {/* Filter bar — controls on the page surface, not inside a box */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search mine or mineral…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              aria-label="Search records"
            />
          </div>

          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter by extraction method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="opencast">Opencast</SelectItem>
              <SelectItem value="underground">Underground</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <span className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{sorted.length}</span> records
        </span>
      </div>

      {/* The table is the page — one container, no nesting */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead field="mineName" label="Mine project" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
              <SortableHead field="subsidiary" label="Subsidiary" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
              <SortableHead field="productionNum" label="Production" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} className="text-right" />
              <TableHead>Method</TableHead>
              <TableHead>Mineral</TableHead>
              <TableHead className="text-right">Reserves</TableHead>
              <SortableHead field="confidence" label="Confidence" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
              <TableHead>Validation</TableHead>
              <TableHead className="text-right">Source</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.mineName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.subsidiary}</TableCell>
                <TableCell className={cn("text-right font-mono tabular-nums", row.productionNum > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {row.production}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.method}</TableCell>
                <TableCell className="text-muted-foreground">{row.mineral}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{row.reserves}</TableCell>
                <TableCell>
                  <ConfidenceMeter value={row.confidence} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right">
                  <SourceCitation
                    evidence={row.evidenceSnippet}
                    compact
                    onClick={() => onInspectEvidence(row.evidenceSnippet)}
                  />
                </TableCell>
              </TableRow>
            ))}

            {sorted.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  No records match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing <span className="font-mono tabular-nums text-foreground">{sorted.length}</span> of{" "}
            <span className="font-mono tabular-nums text-foreground">{RECORDS.length}</span> records
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled aria-label="Previous page">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-mono tabular-nums text-foreground">1</span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled aria-label="Next page">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
