import React, { useState } from "react";
import {
  Settings,
  Cpu,
  FileCode,
  HardDrive,
  CheckCircle2,
  Server,
  Shield,
  RefreshCw,
  Layers,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function SettingsPage() {
  const [apiUrl, setApiUrl] = useState("http://localhost:8000");
  const [modelName, setModelName] = useState("claude-sonnet-4-20250514");
  const [ocrConfidence, setOcrConfidence] = useState(85);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-zinc-800/80 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          System & Model Configuration
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          FastAPI backend bridge, LLM extraction hyperparameters & OCR ingestion thresholds.
        </p>
      </div>

      <div className="space-y-4">
        {/* Backend API Configuration */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Server className="h-4 w-4 text-sky-400" />
              <span>FastAPI Backend Connection</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Host address for document processing endpoints, SQLite ORM & PDF downloads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-zinc-400 font-medium block mb-1.5">API Base URL</label>
                <Input
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="bg-zinc-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-zinc-400 font-medium block mb-1.5">Connection Mode</label>
                <div className="h-8 rounded border border-zinc-800 bg-zinc-950 px-3 flex items-center text-xs font-mono text-emerald-400">
                  Dual: Auto-Fallback
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI & Extraction Hyperparameters */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-400" />
              <span>AI Extraction Engine (Claude API)</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Foundation model parameters for document summarization, entity tagging & Q&A.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-zinc-400 font-medium block mb-1.5">Model Architecture</label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full h-8 rounded border border-zinc-700 bg-zinc-950 px-2 text-xs font-mono text-zinc-200 focus:outline-none"
                >
                  <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514 (Recommended)</option>
                  <option value="claude-3-7-sonnet">claude-3-7-sonnet</option>
                  <option value="claude-3-5-haiku">claude-3-5-haiku (High Speed)</option>
                  <option value="mock-ai-engine">Deterministic CMPDI Mock Engine</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 font-medium block mb-1.5">
                  OCR Minimum Confidence Threshold ({ocrConfidence}%)
                </label>
                <input
                  type="range"
                  min="60"
                  max="98"
                  value={ocrConfidence}
                  onChange={(e) => setOcrConfidence(Number(e.target.value))}
                  className="w-full h-2 rounded bg-zinc-800 accent-emerald-400 cursor-pointer"
                />
                <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                  Scans below this score trigger the Validation & Traceability Center.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Information & SIH Metadata */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-zinc-400" />
              <span>Platform Build & Governance Metadata</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
              <div className="rounded border border-zinc-800 bg-zinc-950 p-2.5">
                <span className="text-zinc-500 block text-[10px]">PROBLEM STATEMENT</span>
                <span className="text-zinc-200 font-bold">SIH26023</span>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950 p-2.5">
                <span className="text-zinc-500 block text-[10px]">MINISTRY / ORG</span>
                <span className="text-zinc-200 font-bold">Ministry of Coal / CMPDI</span>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950 p-2.5">
                <span className="text-zinc-500 block text-[10px]">FRONTEND STACK</span>
                <span className="text-zinc-200 font-bold">React 18 + Vite + TS</span>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950 p-2.5">
                <span className="text-zinc-500 block text-[10px]">UI DESIGN SYSTEM</span>
                <span className="text-zinc-200 font-bold">Shadcn / Zinc Dark</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isSaved && (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Configuration Saved Successfully
            </span>
          )}
          <Button onClick={handleSave} className="gap-1.5 font-medium bg-zinc-100 text-zinc-950 hover:bg-zinc-200">
            <Save className="h-3.5 w-3.5" />
            <span>Save Configuration</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
