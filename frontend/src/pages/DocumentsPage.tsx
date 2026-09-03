import React, { useState, useEffect, useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/PageHeader";
import { FieldLabel } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceMeter } from "@/components/shared/ConfidenceMeter";
import { cn } from "@/lib/utils";
import { MiningDocument, EvidenceSnippet, Subsidiary } from "@/types";
import { fetchDocuments, uploadMiningDocument } from "@/services/documents";

interface DocumentsPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

function Attribute({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function DocumentsPage({ onInspectEvidence, selectedSubsidiary }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<MiningDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments().then((docs) => {
      setDocuments(docs);
      if (docs.length > 0) setSelectedDoc(docs[0]);
    });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newDoc = await uploadMiningDocument(
        files[0],
        selectedSubsidiary === "ALL" ? "SECL" : selectedSubsidiary
      );
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = documents.filter((doc) => {
    const matchesSub = selectedSubsidiary === "ALL" || doc.subsidiary === selectedSubsidiary;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      doc.filename.toLowerCase().includes(q) ||
      doc.mineName.toLowerCase().includes(q) ||
      doc.mineralType.toLowerCase().includes(q);
    return matchesSub && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Archival mining reports, geological surveys and production ledgers, with their extracted entities."
        actions={
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
              className="hidden"
            />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              <Upload className="h-3.5 w-3.5" />
              {isUploading ? "Extracting…" : "Upload document"}
            </Button>
          </>
        }
      />

      {selectedDoc ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Index rail */}
          <div className="lg:col-span-3">
            <Input
              placeholder="Filter documents…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter documents"
            />

            <ul className="mt-3 divide-y divide-border border-y border-border">
              {filtered.map((doc) => {
                const isSelected = selectedDoc.id === doc.id;
                return (
                  <li key={doc.id}>
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "relative w-full py-3 pl-4 pr-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        isSelected ? "bg-accent" : "hover:bg-muted/60"
                      )}
                    >
                      {isSelected && (
                        <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />
                      )}
                      <div className="truncate text-sm font-medium text-foreground">
                        {doc.filename}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{doc.subsidiary}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{doc.mineName}</span>
                      </div>
                      <div className="mt-1.5">
                        <StatusBadge status={doc.validationStatus} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Document reader — a paper surface */}
          <div className="lg:col-span-5">
            <div className="flex items-baseline justify-between gap-3 pb-3">
              <h2 className="min-w-0 truncate text-base font-semibold tracking-tight text-foreground">
                {selectedDoc.filename}
              </h2>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {selectedDoc.pageCount} pp.
              </span>
            </div>

            <article className="rounded-lg border border-border bg-card p-6 shadow-xs">
              <header className="border-b border-border pb-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Ministry of Coal · {selectedDoc.subsidiary}
                </div>
                <h3 className="mt-1.5 font-serif text-lg font-semibold leading-snug text-foreground">
                  {selectedDoc.mineName}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{selectedDoc.location}</p>
              </header>

              <div className="mt-5 space-y-4 font-serif text-sm leading-relaxed text-foreground">
                {/* The grounded passage is the visual anchor of the reader */}
                <blockquote className="border-l-2 border-teal bg-teal-muted/50 py-3 pl-4 pr-3">
                  {selectedDoc.evidenceSnippets[0]?.originalContext || selectedDoc.summary}
                </blockquote>

                <p>
                  Geological borehole reconnaissance confirmed structural continuity across the coal
                  seams during the recorded operational cycle. Production excavation yielded{" "}
                  <strong className="font-mono text-sm font-semibold">
                    {selectedDoc.quantityExtracted}
                  </strong>{" "}
                  with heavy mining equipment in continuous operation.
                </p>

                <p className="text-muted-foreground">
                  Statutory safety and environmental regulations under DGMS and MoEFCC were adhered
                  to, with vibration, noise and PM10 monitoring stations recording no
                  non-compliance points.
                </p>
              </div>
            </article>
          </div>

          {/* Extracted entities — a definition list, not a grid of boxes */}
          <div className="lg:col-span-4">
            <div className="flex items-baseline justify-between gap-3 pb-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Extracted</h2>
              <ConfidenceMeter value={selectedDoc.confidenceScore} />
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <FieldLabel>Reported output</FieldLabel>
              <div className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
                {selectedDoc.quantityExtracted}
              </div>

              <dl className="mt-4 divide-y divide-border border-t border-border">
                <Attribute label="Mineral" value={selectedDoc.mineralType} />
                <Attribute label="Method" value={selectedDoc.extractionMethod} />
                <Attribute
                  label="Proved reserves"
                  value={<span className="font-mono tabular-nums">{selectedDoc.reserveEstimate}</span>}
                />
                <Attribute label="District" value={`${selectedDoc.district}, ${selectedDoc.state}`} />
              </dl>
            </div>

            {selectedDoc.keyFindings && selectedDoc.keyFindings.length > 0 && (
              <div className="mt-6">
                <FieldLabel>Key findings</FieldLabel>
                <ul className="mt-2 space-y-2">
                  {selectedDoc.keyFindings.map((finding, idx) => (
                    <li key={idx} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                      <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6">
              <FieldLabel>Topics</FieldLabel>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                {selectedDoc.topics.map((t, idx) => (
                  <span key={idx} className="text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Evidence snippets keep their containment — they are exhibits */}
            <FieldLabel>Evidence</FieldLabel>
            <div className="mt-2 space-y-2">
              {selectedDoc.evidenceSnippets.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onInspectEvidence(ev)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-xs transition-colors hover:border-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">
                      p.{ev.pageNumber} · {ev.sectionHeader}
                    </span>
                    <ConfidenceMeter value={ev.confidence} compact />
                  </div>
                  <div className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {ev.extractedValue}
                  </div>
                  <p className="mt-1 line-clamp-2 font-serif text-xs leading-relaxed text-muted-foreground">
                    {ev.originalContext}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">No documents found.</p>
      )}
    </div>
  );
}
