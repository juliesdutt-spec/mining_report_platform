import React, { useState } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const SECTIONS = [
  { key: "execSummary", label: "Executive summary" },
  { key: "productionOverview", label: "Production overview" },
  { key: "keyFindings", label: "Key findings" },
  { key: "aiInsights", label: "Anomaly detection" },
  { key: "sourceReferences", label: "Source references" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const PRODUCTION_ROWS = [
  { subsidiary: "SECL", mine: "Gevra OC", actual: "52.50", target: "50.00", ratio: "1:1.18", status: "Validated" },
  { subsidiary: "NCL", mine: "Jayant OC", actual: "25.00", target: "25.00", ratio: "1:2.05", status: "Weighbridge check" },
  { subsidiary: "BCCL", mine: "Moonidih UG", actual: "1.42", target: "1.50", ratio: "—", status: "Validated" },
];

export function ReportStudioPage() {
  const [reportType, setReportType] = useState("executive_summary");
  const [reportingPeriod, setReportingPeriod] = useState("fy2023_24");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Record<SectionKey, boolean>>({
    execSummary: true,
    productionOverview: true,
    keyFindings: true,
    aiInsights: true,
    sourceReferences: true,
  });

  const toggleSection = (key: SectionKey) =>
    setSelectedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 900);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Studio"
        description="Compose statutory reports and parliamentary dossiers from indexed sources."
        actions={
          <>
            <Button variant="ghost" size="sm">
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" />
              DOCX
            </Button>
            <Button size="sm">
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Configuration — a real form */}
        <div className="lg:col-span-4">
          <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs">
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

            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
              <RefreshCw className={isGenerating ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              {isGenerating ? "Compiling…" : "Generate report"}
            </Button>
          </div>
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
                  <p className="mt-2 font-serif text-sm leading-relaxed text-foreground">
                    Aggregated raw coal excavation across Coal India Limited subsidiaries reached{" "}
                    <strong className="font-mono text-sm font-semibold">773.60 MT</strong>, maintaining
                    a 10.0% annualised expansion. Mechanised opencast quarries contributed 93.8% of
                    total volume, led by SECL Gevra (52.50 MT) and NCL Jayant (25.00 MT). Operations
                    maintained compliance with DGMS statutory standards with zero fatal incidents
                    logged across automated dispatch silos.
                  </p>
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
                          <TableHead>Subsidiary</TableHead>
                          <TableHead>Lead mine</TableHead>
                          <TableHead className="text-right">Actual</TableHead>
                          <TableHead className="text-right">Target</TableHead>
                          <TableHead className="text-right">Stripping</TableHead>
                          <TableHead>Validation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {PRODUCTION_ROWS.map((row) => (
                          <TableRow key={row.subsidiary}>
                            <TableCell className="font-mono text-xs font-medium text-foreground">
                              {row.subsidiary}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{row.mine}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                              {row.actual}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                              {row.target}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                              {row.ratio}
                            </TableCell>
                            <TableCell
                              className={
                                row.status === "Validated"
                                  ? "text-xs text-success"
                                  : "text-xs text-warning"
                              }
                            >
                              {row.status}
                            </TableCell>
                          </TableRow>
                        ))}
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
                  <ul className="mt-2 space-y-2">
                    {[
                      "First-Mile Connectivity rapid-loading systems eliminated 1,200 truck trips per day at Jayant Project.",
                      "BCCL longwall face degasification held roadway methane below the 0.3% threshold.",
                      "Overburden removal across SECL opencast mines held at 1.18 m³/t against a 1.25 ceiling.",
                    ].map((finding, idx) => (
                      <li key={idx} className="flex gap-3 font-serif text-sm leading-relaxed text-foreground">
                        <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {selectedSections.aiInsights && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    4 · Anomaly detection
                  </h3>
                  <p className="mt-2 border-l-2 border-warning bg-warning-muted/40 py-2.5 pl-4 pr-3 font-serif text-sm leading-relaxed text-foreground">
                    Historical telemetry shows a 1.5% reconciliation gap between bunker weighbridge
                    readouts and rake dispatch manifests during peak monsoon intervals. Automated
                    cross-verification with Indian Railways FOIS telemetry is recommended.
                  </p>
                </section>
              )}

              {selectedSections.sourceReferences && (
                <section className="border-t border-border pt-5">
                  <FieldLabel>Grounding lineage</FieldLabel>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Synthesised from SECL_Gevra_Annual_Production_2023_24.pdf (p.14),
                    NCL_Jayant_Expansion_Review_FY24.pdf (p.19), and
                    BCCL_Jharia_Seam_XVI_Geological_Survey.pdf (p.38).
                  </p>
                </section>
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
