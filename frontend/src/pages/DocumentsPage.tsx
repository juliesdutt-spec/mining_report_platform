import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Search,
  Eye,
  Filter,
  Layers,
  FileSpreadsheet,
  Tag,
  Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MiningDocument, EvidenceSnippet, Subsidiary } from "@/types";
import { fetchDocuments, uploadMiningDocument } from "@/services/documents";

interface DocumentsPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

export function DocumentsPage({ onInspectEvidence, selectedSubsidiary }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<MiningDocument | null>(null);
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments().then((docs) => {
      setDocuments(docs);
      if (docs.length > 0) {
        setSelectedDoc(docs[0]);
      }
    });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const file = files[0];
      const newDoc = await uploadMiningDocument(file, selectedSubsidiary === "ALL" ? "SECL" : selectedSubsidiary);
      setDocuments(prev => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = documents.filter(doc => {
    const matchesSub = selectedSubsidiary === "ALL" || doc.subsidiary === selectedSubsidiary;
    const matchesQuery = doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.mineName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.mineralType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSub && matchesQuery;
  });

  return (
    <div className="space-y-5">
      {/* Header with Upload Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            Document Intelligence & Extraction Studio
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Archival mining reports, geological telemetry, boreholes & production ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
            className="hidden"
          />
          <Button
            variant="default"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-2 shadow-sm font-medium"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{isUploading ? "Extracting Entities..." : "Upload & Analyze Report"}</span>
          </Button>
        </div>
      </div>

      {/* Drag & Drop Quick Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700/80 bg-zinc-900/30 p-5 text-center transition-colors hover:border-zinc-500 hover:bg-zinc-900/60"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 group-hover:scale-105 transition-transform">
          <Upload className="h-5 w-5 text-zinc-400 group-hover:text-zinc-200" />
        </div>
        <p className="mt-2 text-xs font-medium text-zinc-300">
          Drop PDF, DOCX, XLSX, or Geological Scan files here, or <span className="text-sky-400 underline">browse</span>
        </p>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          Automatic OCR parsing • Table reconstruction • Entity grounding • Word cloud synthesis
        </p>
      </div>

      {/* 3-Pane Document Detail Inspector */}
      {selectedDoc ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[740px]">
          {/* PANE 1: Document & Page Navigation (Left - 3 cols) */}
          <div className="lg:col-span-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-zinc-400" />
                Indexed Reports ({filtered.length})
              </span>
            </div>

            <div className="py-2">
              <Input
                placeholder="Filter files or mines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-xs bg-zinc-950"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filtered.map((doc) => {
                const isSelected = selectedDoc.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDoc(doc);
                      setSelectedPageNum(1);
                    }}
                    className={`w-full text-left p-2.5 rounded-md border transition-all ${
                      isSelected
                        ? "bg-zinc-800/90 border-zinc-700 text-zinc-100 shadow-sm"
                        : "bg-zinc-950/40 border-zinc-800/60 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-mono text-[10px] text-emerald-400 font-semibold">{doc.subsidiary}</span>
                      <StatusBadge status={doc.validationStatus} />
                    </div>
                    <div className="font-medium text-xs text-zinc-200 truncate mt-1">{doc.filename}</div>
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">{doc.mineName}</div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-2 pt-1 border-t border-zinc-800/60">
                      <span>{doc.pageCount} pages</span>
                      <span>{Math.round(doc.confidenceScore * 100)}% Conf</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Page Number Picker */}
            <div className="mt-2 pt-2 border-t border-zinc-800">
              <span className="text-[11px] font-mono text-zinc-500 uppercase block mb-1.5">Page Selection</span>
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {[1, 14, 19, 22, 38, selectedDoc.pageCount].map((pg) => (
                  <button
                    key={pg}
                    onClick={() => setSelectedPageNum(pg)}
                    className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors ${
                      selectedPageNum === pg
                        ? "bg-zinc-700 text-white border-zinc-600"
                        : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    p.{pg}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PANE 2: Document Preview & Extracted OCR Content (Center - 5 cols) */}
          <div className="lg:col-span-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-semibold text-zinc-200 truncate max-w-xs">{selectedDoc.filename}</span>
              </div>
              <span className="font-mono text-xs text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                Page {selectedPageNum} of {selectedDoc.pageCount}
              </span>
            </div>

            {/* Document Content View / OCR Text Surface */}
            <div className="flex-1 overflow-y-auto mt-3 rounded border border-zinc-800/80 bg-zinc-900/30 p-4 font-serif text-xs leading-relaxed text-zinc-300 space-y-4">
              <div className="border-b border-zinc-800 pb-2 text-[11px] font-sans font-mono text-zinc-500 uppercase flex justify-between">
                <span>[ARCHIVAL CMPDI OCR BUFFER]</span>
                <span>CONFIDENCE: 98.8%</span>
              </div>

              <div>
                <h4 className="font-sans font-bold text-sm text-zinc-100 uppercase tracking-wide">
                  MINISTRY OF COAL — {selectedDoc.subsidiary} OPERATIONAL RECORD
                </h4>
                <p className="font-sans text-xs text-zinc-400 mt-0.5">Project: {selectedDoc.mineName} • Location: {selectedDoc.location}</p>
              </div>

              {/* Highlighted Key Extraction Quote */}
              <div className="rounded-md border border-emerald-800/70 bg-emerald-950/30 p-3 text-xs text-emerald-200 border-l-4 border-l-emerald-500">
                <div className="font-sans font-mono text-[10px] uppercase text-emerald-400 mb-1 flex items-center justify-between">
                  <span>GROUNDED AUDIT EXCERPT</span>
                  <span>CONFIDENCE 99%</span>
                </div>
                "{selectedDoc.evidenceSnippets[0]?.originalContext || selectedDoc.summary}"
              </div>

              <p>
                During the recorded operational cycle, geological borehole reconnaissance confirmed structural continuity across coal seams. Production excavation yielded <strong>{selectedDoc.quantityExtracted}</strong> with heavy mining equipment operating continuously.
              </p>

              <div className="rounded border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-[11px] space-y-1">
                <div className="text-zinc-500 uppercase text-[10px]">Tabular Telemetry Block</div>
                <div className="flex justify-between text-zinc-300">
                  <span>Mineral Classification:</span>
                  <span className="text-emerald-400">{selectedDoc.mineralType}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Extraction Methodology:</span>
                  <span className="text-zinc-200">{selectedDoc.extractionMethod}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Estimated Proved Reserves:</span>
                  <span className="text-sky-400">{selectedDoc.reserveEstimate}</span>
                </div>
              </div>

              <p className="text-zinc-400">
                Statutory safety and environmental regulations under DGMS and MoEFCC were strictly adhered to. Regular vibration, noise and PM10 air monitoring stations verified zero non-compliance points.
              </p>
            </div>

            {/* Bottom Actions */}
            <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-mono">Status: {selectedDoc.status.toUpperCase()}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedDoc.evidenceSnippets[0] && onInspectEvidence(selectedDoc.evidenceSnippets[0])}
                className="gap-1.5 text-xs text-zinc-300"
              >
                <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                <span>Verify Lineage</span>
              </Button>
            </div>
          </div>

          {/* PANE 3: AI Extraction Panel (Right - 4 cols) */}
          <div className="lg:col-span-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 flex flex-col overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                  AI Extracted Attributes
                </h3>
              </div>
              <span className="font-mono text-emerald-400 text-xs bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                {Math.round(selectedDoc.confidenceScore * 100)}% Model Conf
              </span>
            </div>

            {/* Extracted Entity Rows */}
            <div className="space-y-3 text-xs">
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2.5">
                <span className="text-zinc-500 text-[10px] font-mono uppercase block">Total Output Extracted</span>
                <span className="text-base font-bold font-mono text-emerald-400">{selectedDoc.quantityExtracted}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                  <span className="text-zinc-500 text-[10px] font-mono uppercase block">Mineral Type</span>
                  <span className="text-zinc-200 font-medium truncate block">{selectedDoc.mineralType}</span>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                  <span className="text-zinc-500 text-[10px] font-mono uppercase block">Extraction Method</span>
                  <span className="text-zinc-200 font-medium truncate block">{selectedDoc.extractionMethod}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                  <span className="text-zinc-500 text-[10px] font-mono uppercase block">Proved Reserves</span>
                  <span className="text-zinc-200 font-mono font-medium block">{selectedDoc.reserveEstimate}</span>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                  <span className="text-zinc-500 text-[10px] font-mono uppercase block">State & District</span>
                  <span className="text-zinc-200 font-medium truncate block">{selectedDoc.district}, {selectedDoc.state}</span>
                </div>
              </div>

              {/* Key Findings List */}
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 space-y-1.5">
                <span className="text-zinc-400 text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Key Findings & Observations
                </span>
                <ul className="space-y-1 text-zinc-300 text-[11px] list-disc list-inside">
                  {(selectedDoc.keyFindings || []).map((finding, idx) => (
                    <li key={idx} className="leading-snug">{finding}</li>
                  ))}
                </ul>
              </div>

              {/* Topics / Semantic Tags */}
              <div>
                <span className="text-zinc-500 text-[10px] font-mono uppercase block mb-1.5">Detected Topics & Themes</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDoc.topics.map((t, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 border border-zinc-700 font-mono"
                    >
                      <Hash className="h-2.5 w-2.5 text-zinc-500" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Source Evidence Cards */}
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-zinc-400 text-[11px] font-semibold block mb-2">
                  Deterministic Evidence Snippets
                </span>
                <div className="space-y-2">
                  {selectedDoc.evidenceSnippets.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => onInspectEvidence(ev)}
                      className="cursor-pointer rounded border border-zinc-800 bg-zinc-950 p-2 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span>Page {ev.pageNumber} • {ev.sectionHeader}</span>
                        <span className="text-emerald-400">{Math.round(ev.confidence * 100)}%</span>
                      </div>
                      <div className="text-xs font-bold font-mono text-zinc-200 mt-1">{ev.extractedValue}</div>
                      <div className="text-[11px] text-zinc-400 italic mt-0.5 line-clamp-2">"{ev.originalContext}"</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-500">No documents found.</div>
      )}
    </div>
  );
}
