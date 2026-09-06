import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceMeter } from "@/components/shared/ConfidenceMeter";
import { SourceCitation } from "@/components/shared/SourceCitation";
import { cn } from "@/lib/utils";
import { EvidenceSnippet, MiningDocument, OrganisationFilter } from "@/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { fetchDocuments } from "@/services/documents";

interface DataExplorerPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedOrganisation: OrganisationFilter;
}


type SortField = "mineName" | "organisation" | "productionNum" | "confidence";

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

export function DataExplorerPage({ onInspectEvidence, selectedOrganisation }: DataExplorerPageProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("mineName");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Rows are the real indexed reports from GET /reports.
  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setIsLoading(false));
  }, []);

  const records = documents.map((doc) => ({
    id: String(doc.id),
    mineName: doc.mineName ?? doc.filename,
    organisation: doc.organisation,
    production: doc.quantityExtracted,
    productionNum: parseFloat((doc.quantityExtracted ?? "").replace(/[^0-9.]/g, "")) || 0,
    method: doc.extractionMethod,
    mineral: doc.mineralType,
    reserves: doc.reserveEstimate,
    confidence: doc.confidenceScore,
    status: doc.validationStatus ?? doc.status,
    filename: doc.filename,
    evidenceSnippet: doc.evidenceSnippets[0],
  }));

  const filtered = records.filter((item) => {
    const matchesSub = selectedOrganisation === "ALL" || item.organisation === selectedOrganisation;
    const matchesMethod =
      filterMethod === "all" || (item.method ?? "").toLowerCase() === filterMethod;
    const q = search.toLowerCase();
    const matchesSearch =
      item.mineName.toLowerCase().includes(q) || (item.mineral ?? "").toLowerCase().includes(q);
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

  /**
   * Export the rows as shown - same filter, same search, same sort order.
   *
   * Built from `sorted` rather than the unfiltered records so the file
   * matches the table the user is looking at; exporting everything would
   * silently ignore the controls they just used.
   */
  const handleExportCsv = () => {
    if (sorted.length === 0) return;
    const rows: unknown[][] = [
      [
        "Mine project",
        "Organisation",
        "Production",
        "Method",
        "Mineral",
        "Reserves",
        "Confidence",
        "Validation",
        "Source document",
      ],
      ...sorted.map((r) => [
        r.mineName,
        r.organisation ?? "",
        r.production ?? "",
        r.method ?? "",
        r.mineral ?? "",
        r.reserves ?? "",
        r.confidence ?? "",
        r.status ?? "",
        r.filename,
      ]),
    ];
    downloadCsv("dataforge-records.csv", toCsv(rows));
  };

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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={sorted.length === 0}
            title={
              sorted.length === 0
                ? "No rows to export"
                : "Download the rows as currently filtered and sorted"
            }
          >
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
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead field="mineName" label="Mine project" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
              <SortableHead field="organisation" label="Organisation" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
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
            {isLoading &&
              [0, 1, 2, 3].map((i) => (
                <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                  {Array.from({ length: 9 }).map((_, c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && sorted.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.mineName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.organisation ?? "\u2014"}</TableCell>
                <TableCell className={cn("text-right font-mono tabular-nums", row.productionNum > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {row.production ?? "\u2014"}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.method ?? "\u2014"}</TableCell>
                <TableCell className="text-muted-foreground">{row.mineral ?? "\u2014"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{row.reserves ?? "\u2014"}</TableCell>
                <TableCell>
                  <ConfidenceMeter value={row.confidence} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right">
                  {row.evidenceSnippet ? (
                    <SourceCitation
                      evidence={row.evidenceSnippet}
                      compact
                      onClick={() => onInspectEvidence(row.evidenceSnippet!)}
                    />
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground" title={row.filename}>
                      {row.filename}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {!isLoading && sorted.length === 0 && (
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
            <span className="font-mono tabular-nums text-foreground">{records.length}</span> records
          </span>
          {/* No pager: the table renders every matching row, so a page
              control could only ever say "1" with both arrows dead, which
              read as pages that exist but cannot be reached. */}
        </div>
      </Card>
    </div>
  );
}
