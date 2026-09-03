import React from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { EvidenceSnippet } from "@/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfidenceMeter } from "@/components/shared/ConfidenceMeter";
import { FieldLabel } from "@/components/shared/Section";

interface EvidenceSheetProps {
  evidence: EvidenceSnippet | null;
  isOpen: boolean;
  onClose: () => void;
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-xs font-medium text-foreground">{children}</dd>
    </div>
  );
}

/**
 * The authoritative evidence exhibit. This is DataForge's strongest identity
 * surface: the extracted datum in mono, the verbatim source passage as a
 * quoted serif block with a teal rule, and its provenance underneath.
 */
export function EvidenceSheet({ evidence, isOpen, onClose }: EvidenceSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {evidence && (
          <>
            <SheetHeader className="px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal" />
                <SheetTitle>Evidence inspector</SheetTitle>
              </div>
              <SheetDescription>
                Every extracted figure traces back to a page in the archival source.
              </SheetDescription>
            </SheetHeader>

            <Separator />

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {/* The extracted datum — the answer to "what did we read?" */}
              <FieldLabel>Extracted value</FieldLabel>
              <div className="mt-2 rounded-lg border border-border bg-muted/40 p-4">
                <div className="text-xs text-muted-foreground">{evidence.field}</div>
                <div className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
                  {evidence.extractedValue}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <ConfidenceMeter value={evidence.confidence} />
                  <span className="text-xs text-muted-foreground">extraction confidence</span>
                </div>
              </div>

              {/* The verbatim passage — the answer to "where did we read it?" */}
              <div className="mt-6">
                <FieldLabel>Source passage</FieldLabel>
                <blockquote className="mt-2 border-l-2 border-teal bg-teal-muted/50 py-3 pl-4 pr-3 font-serif text-sm leading-relaxed text-foreground">
                  {evidence.originalContext}
                </blockquote>
              </div>

              {/* Provenance */}
              <div className="mt-6">
                <FieldLabel>Provenance</FieldLabel>
                <dl className="mt-1 divide-y divide-border">
                  <MetaRow label="Document">{evidence.documentName}</MetaRow>
                  <MetaRow label="Page">
                    <span className="font-mono tabular-nums">{evidence.pageNumber}</span>
                  </MetaRow>
                  <MetaRow label="Section">{evidence.sectionHeader}</MetaRow>
                </dl>
              </div>

              <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                <span>
                  Extracted facts retain deterministic lineage to the archival document held in the
                  CMPDI repository.
                </span>
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={onClose}>
                Confirm lineage
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
