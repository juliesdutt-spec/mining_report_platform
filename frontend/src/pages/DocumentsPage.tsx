import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { FieldLabel } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WordCloud } from "@/components/shared/WordCloud";
import { ConfidenceMeter } from "@/components/shared/ConfidenceMeter";
import { cn } from "@/lib/utils";
import { MiningDocument, EvidenceSnippet, Subsidiary } from "@/types";
import {
  deleteDocument,
  fetchDocuments,
  getDocumentById,
  uploadMiningDocument,
} from "@/services/documents";
import { ApiError, reportDownloadUrl } from "@/services/api";

interface DocumentsPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

/** Renders a value, or an em dash when the backend reported nothing for it. */
function orDash(value: React.ReactNode): React.ReactNode {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground">&mdash;</span>;
  }
  return value;
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MiningDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Reload the index from GET /reports, keeping the current selection if it survives. */
  const loadDocuments = async (selectId?: number) => {
    setIsLoading(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      setLoadError(null);
      setSelectedDoc((current) => {
        const target = selectId ?? current?.id;
        return docs.find((d) => d.id === target) ?? docs[0] ?? null;
      });
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load documents.");
      setDocuments([]);
      setSelectedDoc(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  /**
   * GET /reports omits `extracted_data`, so the selected document is re-fetched
   * from GET /reports/{id} to fill in mineral, method, reserves and district.
   */
  useEffect(() => {
    const id = selectedDoc?.id;
    if (id === undefined || selectedDoc?.keyFindings !== undefined) return;

    let cancelled = false;
    void getDocumentById(id).then((detail) => {
      if (cancelled || !detail) return;
      setSelectedDoc((current) => (current?.id === id ? detail : current));
      setDocuments((prev) => prev.map((d) => (d.id === id ? detail : d)));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDoc?.id, selectedDoc?.keyFindings]);

  /** DELETE /reports/{id}, then drop the row locally so nothing stale remains. */
  const handleConfirmDelete = async () => {
    const target = pendingDelete;
    if (!target) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteDocument(target.id);
      setPendingDelete(null);
      setDocuments((prev) => {
        const next = prev.filter((d) => d.id !== target.id);
        setSelectedDoc((current) => (current?.id === target.id ? next[0] ?? null : current));
        return next;
      });
      setUploadNotice(`Deleted "${target.filename}".`);
      setUploadError(null);
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : `Could not delete "${target.filename}".`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * POST /upload takes one file per request, so a multi-file selection is
   * uploaded in sequence. Each result is reported individually: one failure
   * does not discard the documents that succeeded.
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadNotice(null);
    setUploadProgress(files.length > 1 ? { done: 0, total: files.length } : null);

    const succeeded: string[] = [];
    const failed: string[] = [];
    let lastId: number | undefined;

    for (const [index, file] of files.entries()) {
      try {
        const newDoc = await uploadMiningDocument(file);
        succeeded.push(newDoc.filename);
        lastId = newDoc.id;
      } catch (err) {
        failed.push(
          `${file.name}: ${err instanceof ApiError ? err.message : "upload failed"}`
        );
      }
      if (files.length > 1) {
        setUploadProgress({ done: index + 1, total: files.length });
      }
    }

    if (succeeded.length > 0) {
      setUploadNotice(
        succeeded.length === 1
          ? `Processed "${succeeded[0]}" — extracted and indexed.`
          : `Processed ${succeeded.length} documents — extracted and indexed.`
      );
      // Re-read the index from the backend so the list reflects real stored state.
      await loadDocuments(lastId);
    }
    if (failed.length > 0) {
      setUploadError(failed.join(" · "));
    }

    setUploadProgress(null);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filtered = documents.filter((doc) => {
    const matchesSub = selectedSubsidiary === "ALL" || doc.subsidiary === selectedSubsidiary;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      doc.filename.toLowerCase().includes(q) ||
      (doc.mineName ?? "").toLowerCase().includes(q) ||
      (doc.mineralType ?? "").toLowerCase().includes(q);
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
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
            />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              <Upload className="h-3.5 w-3.5" />
              {isUploading ? "Extracting…" : "Upload documents"}
            </Button>
          </>
        }
      />

      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-muted px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadNotice && !uploadError && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-success/40 bg-success-muted px-4 py-3 text-sm text-success"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{uploadNotice}</span>
        </div>
      )}

      {isUploading && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
        >
          <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
          <span>
            {uploadProgress
              ? `Uploading and extracting — ${uploadProgress.done} of ${uploadProgress.total} done.`
              : "Uploading and extracting — the backend runs OCR and AI extraction, which can take a minute."}
          </span>
        </div>
      )}

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
                        <span className="truncate">{doc.mineName ?? doc.filename}</span>
                      </div>
                      <div className="mt-1.5">
                        <StatusBadge status={doc.validationStatus ?? doc.status} />
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
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {selectedDoc.pageCount !== undefined ? `${selectedDoc.pageCount} pp.` : "\u2014"}
                </span>
                {/* GET /reports/{id}/download — the backend generates the PDF. */}
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={reportDownloadUrl(selectedDoc.id)}
                    download
                    aria-label={`Download extracted report PDF for ${selectedDoc.filename}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setDeleteError(null);
                    setPendingDelete(selectedDoc);
                  }}
                  aria-label={`Delete ${selectedDoc.filename}`}
                  title="Delete this document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Tabs defaultValue="document">
              <TabsList>
                <TabsTrigger value="document">Document</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="wordcloud">Word cloud</TabsTrigger>
              </TabsList>

              {/* The generated PDF itself, rendered by the browser's viewer. */}
              <TabsContent value="document">
                <object
                  key={selectedDoc.id}
                  data={reportDownloadUrl(selectedDoc.id)}
                  type="application/pdf"
                  className="h-[560px] w-full rounded-lg border border-border bg-card"
                  aria-label={`PDF report for ${selectedDoc.filename}`}
                >
                  {/* Shown when the browser cannot embed a PDF inline. */}
                  <div className="flex h-[560px] flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Your browser cannot display this PDF inline.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={reportDownloadUrl(selectedDoc.id)} download>
                        <Download className="h-3.5 w-3.5" />
                        Download the PDF
                      </a>
                    </Button>
                  </div>
                </object>
              </TabsContent>

              {/* Only what the backend actually extracted — no narrative filler. */}
              <TabsContent value="summary">
                <article className="rounded-lg border border-border bg-card p-6 shadow-xs">
                  <header className="border-b border-border pb-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Ministry of Coal{selectedDoc.subsidiary ? ` \u00b7 ${selectedDoc.subsidiary}` : ""}
                    </div>
                    <h3 className="mt-1.5 font-serif text-lg font-semibold leading-snug text-foreground">
                      {selectedDoc.mineName ?? selectedDoc.filename}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedDoc.location ?? "Location not reported"}
                    </p>
                  </header>

                  <div className="mt-5 space-y-4 font-serif text-sm leading-relaxed text-foreground">
                    {selectedDoc.summary ? (
                      <blockquote className="border-l-2 border-teal bg-teal-muted/50 py-3 pl-4 pr-3">
                        {selectedDoc.summary}
                      </blockquote>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No summary was extracted from this document.
                      </p>
                    )}

                    {selectedDoc.evidenceSnippets[0]?.originalContext && (
                      <blockquote className="border-l-2 border-border py-2 pl-4 pr-3 text-muted-foreground">
                        {selectedDoc.evidenceSnippets[0].originalContext}
                      </blockquote>
                    )}
                  </div>
                </article>
              </TabsContent>

              {/* GET /reports/{id}/wordcloud */}
              <TabsContent value="wordcloud">
                <Card className="p-5">
                  <WordCloud reportId={selectedDoc.id} />
                  <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    Term frequency computed by the backend from this document's extracted text.
                  </p>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Extracted entities — a definition list, not a grid of boxes */}
          <div className="lg:col-span-4">
            <div className="flex items-baseline justify-between gap-3 pb-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Extracted</h2>
              <ConfidenceMeter value={selectedDoc.confidenceScore} />
            </div>

            <Card className="p-5">
              <FieldLabel>Reported output</FieldLabel>
              <div className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
                {orDash(selectedDoc.quantityExtracted)}
              </div>

              <dl className="mt-4 divide-y divide-border border-t border-border">
                <Attribute label="Mineral" value={orDash(selectedDoc.mineralType)} />
                <Attribute label="Method" value={orDash(selectedDoc.extractionMethod)} />
                <Attribute
                  label="Proved reserves"
                  value={orDash(selectedDoc.reserveEstimate && <span className="font-mono tabular-nums">{selectedDoc.reserveEstimate}</span>)}
                />
                <Attribute
                  label="District"
                  value={orDash([selectedDoc.district, selectedDoc.state].filter(Boolean).join(", "))}
                />
              </dl>
            </Card>

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
      ) : isLoading ? (
        // Skeletons mirror the three-pane layout rather than showing placeholder data.
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-3">
            <Skeleton className="h-8 w-full" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="mt-3 h-[560px] w-full" />
          </div>
          <div className="lg:col-span-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="mt-3 h-64 w-full" />
          </div>
        </div>
      ) : loadError ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void loadDocuments()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No documents indexed yet. Upload a PDF mining report to get started.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload document
          </Button>
        </div>
      )}

      {/* Delete confirmation — DELETE /reports/{id} is irreversible. */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.filename} will be permanently removed from the reports database,
              along with its extracted entities and word cloud. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
