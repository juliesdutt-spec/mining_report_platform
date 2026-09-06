import React, { useEffect, useState } from "react";
import { AlertCircle, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { FieldLabel } from "@/components/shared/Section";
import { dossierUrl } from "@/services/api";
import { fetchDocuments } from "@/services/documents";
import { MiningDocument } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

const SECTIONS = [
  { key: "execSummary", label: "Executive summary" },
  { key: "productionOverview", label: "Production overview" },
  { key: "keyFindings", label: "Key findings" },
  { key: "sourceReferences", label: "Source references" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export function ReportStudioPage() {
  const [reportType, setReportType] = useState("executive_summary");
  const [reportingPeriod, setReportingPeriod] = useState("fy2023_24");
  const [selectedSections, setSelectedSections] = useState<Record<SectionKey, boolean>>({
    execSummary: true,
    productionOverview: true,
    keyFindings: true,
    sourceReferences: true,
  });

  const toggleSection = (key: SectionKey) =>
    setSelectedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // The preview below re-renders directly from the section toggles, so there is
  // nothing to "generate" — no simulated delay is shown.
  const handlePrint = () => window.print();

  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // The preview and the generated PDF read the same indexed reports.
  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setIsLoading(false));
  }, []);

  const periodLabel =
    reportingPeriod === "fy2023_24"
      ? "FY 2023-24 (annual)"
      : reportingPeriod === "fy2024_25_q1"
        ? "FY 2024-25 Q1"
        : "FY 2024-25 Q2";

  // The template chooses what the dossier is called. It selected nothing
  // before: all four options produced a document titled identically, so the
  // control claimed four statutory document types and delivered one.
  const TEMPLATE_TITLES: Record<string, string> = {
    executive_summary: "Executive Production Summary",
    statutory_audit: "Statutory DGMS Safety Audit",
    parliamentary: "Parliamentary Inquiry Dossier",
    geological_reserve: "Geological Exploration Assessment",
  };
  const dossierTitle = TEMPLATE_TITLES[reportType] ?? "Consolidated Mining Report Dossier";

  // Both exports compose the same dossier from the same sections; only the
  // container differs, so the two files cannot disagree about the corpus.
  const dossierOptions = {
    title: dossierTitle,
    period: periodLabel,
    execSummary: selectedSections.execSummary,
    productionOverview: selectedSections.productionOverview,
    keyFindings: selectedSections.keyFindings,
    sourceReferences: selectedSections.sourceReferences,
  };
  const downloadHref = dossierUrl({ ...dossierOptions, format: "pdf" });
  const docxHref = dossierUrl({ ...dossierOptions, format: "docx" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Studio"
        description="Compose statutory reports and parliamentary dossiers from indexed sources."
        actions={
          <>
            {/* Print is the only export that needs no backend. */}
            <Button variant="ghost" size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            {/* GET /reports/generate?format=docx composes the same dossier. */}
            <Button variant="outline" size="sm" asChild>
              <a href={docxHref} download aria-label="Download the composed dossier as DOCX">
                <Download className="h-3.5 w-3.5" />
                DOCX
              </a>
            </Button>
            {/* POST /reports/generate composes the dossier from indexed reports. */}
            <Button size="sm" asChild>
              <a href={downloadHref} download aria-label="Download the composed dossier as PDF">
                <Download className="h-3.5 w-3.5" />
                PDF
              </a>
            </Button>
          </>
        }
      />

      <div
        role="note"
        className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          The preview and the downloaded PDF are both composed from the{" "}
          <strong className="font-medium text-foreground">{documents.length}</strong> report(s)
          currently indexed. Sections with no supporting data say so rather than being filled in.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Configuration — a real form */}
        <div className="lg:col-span-4">
          <Card className="space-y-5 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="report-template">Template</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="report-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive_summary">Executive production summary</SelectItem>
                  <SelectItem value="statutory_audit">Statutory DGMS safety audit</SelectItem>
                  <SelectItem value="parliamentary">Parliamentary inquiry dossier</SelectItem>
                  <SelectItem value="geological_reserve">Geological exploration assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-period">Reporting period</Label>
              <Select value={reportingPeriod} onValueChange={setReportingPeriod}>
                <SelectTrigger id="report-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fy2023_24">FY 2023-24 (annual)</SelectItem>
                  <SelectItem value="fy2024_25_q1">FY 2024-25 Q1</SelectItem>
                  <SelectItem value="fy2024_25_q2">FY 2024-25 Q2</SelectItem>
                </SelectContent>
              </Select>
              {/* Uploaded reports rarely carry a parseable date - report_date
                  is null on most extractions - so this cannot select which
                  documents are included, and the dossier says so itself. */}
              <p className="text-xs text-muted-foreground">
                Printed on the dossier as its filing period. It does not filter
                which documents are included — every indexed report is.
              </p>
            </div>

            <div className="space-y-2.5">
              <FieldLabel>Sections</FieldLabel>
              {SECTIONS.map((sec) => (
                <div key={sec.key} className="flex items-center gap-2.5">
                  <Checkbox
                    id={sec.key}
                    checked={selectedSections[sec.key]}
                    onCheckedChange={() => toggleSection(sec.key)}
                  />
                  <Label htmlFor={sec.key} className="cursor-pointer text-sm font-normal">
                    {sec.label}
                  </Label>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              The preview updates as you change these options.
            </p>
          </Card>
        </div>

        {/* Preview — an authoritative paper surface */}
        <div className="lg:col-span-8">
          <article className="rounded-lg border border-border bg-card p-8 shadow-xs">
            <header className="border-b border-border pb-5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Government of India · Ministry of Coal
              </div>
              <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug tracking-tight text-foreground">
                Executive Production &amp; Statutory Compliance Dossier
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>FY 2023-24</span>
                <span aria-hidden>·</span>
                <span>SECL, NCL, BCCL, MCL</span>
                <span aria-hidden>·</span>
                <span>Generated {new Date().toLocaleDateString("en-IN")}</span>
              </div>
            </header>

            <div className="space-y-8 pt-6">
              {selectedSections.execSummary && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    1 · Executive summary
                  </h3>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-16 w-full" />
                  ) : (
                    <p className="mt-2 font-serif text-sm leading-relaxed text-foreground">
                      This dossier consolidates{" "}
                      <strong className="font-mono text-sm font-semibold">{documents.length}</strong>{" "}
                      indexed report(s) for {periodLabel}. Minerals recorded:{" "}
                      {[...new Set(documents.map((d) => d.mineralType).filter(Boolean))].join(", ") ||
                        "none recorded"}
                      . Locations referenced:{" "}
                      {[...new Set(documents.map((d) => d.location).filter(Boolean))].join(", ") ||
                        "none recorded"}
                      .
                    </p>
                  )}
                </section>
              )}

              {selectedSections.productionOverview && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    2 · Production overview
                  </h3>
                  <div className="mt-3 overflow-hidden rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Document</TableHead>
                          <TableHead>Mineral</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading &&
                          [0, 1].map((i) => (
                            <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                              {Array.from({ length: 5 }).map((_, c) => (
                                <TableCell key={c}>
                                  <Skeleton className="h-4 w-full" />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}

                        {!isLoading && documents.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="max-w-[220px] truncate font-medium text-foreground" title={doc.filename}>
                              {doc.filename}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {doc.mineralType ?? "\u2014"}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                              {doc.quantityExtracted ?? "\u2014"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {doc.extractionMethod ?? "\u2014"}
                            </TableCell>
                            <TableCell className="text-xs text-success">{doc.status}</TableCell>
                          </TableRow>
                        ))}

                        {!isLoading && documents.length === 0 && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                              No documents indexed yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {selectedSections.keyFindings && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    3 · Key findings
                  </h3>
                  {(() => {
                    const findings = documents.flatMap((d) =>
                      (d.keyFindings ?? []).map((f) => ({ doc: d.filename, text: f }))
                    );
                    if (findings.length === 0) {
                      return (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No key findings were extracted from the indexed documents.
                        </p>
                      );
                    }
                    return (
                      <ul className="mt-2 space-y-2">
                        {findings.map((f, idx) => (
                          <li key={idx} className="flex gap-3 font-serif text-sm leading-relaxed text-foreground">
                            <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span>{f.text}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </section>
              )}


              {selectedSections.sourceReferences && (
                <section className="border-t border-border pt-5">
                  <FieldLabel>Grounding lineage</FieldLabel>
                  {documents.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No source documents are indexed.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                      {documents.map((doc) => (
                        <li key={doc.id} className="font-mono">
                          [{doc.id}] {doc.filename}
                          {doc.pageCount !== undefined ? ` (${doc.pageCount} pages)` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
