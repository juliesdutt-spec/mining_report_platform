import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Loader2, Save } from "lucide-react";
import {
  AiStatus,
  ApiError,
  ReindexResult,
  RetrievalStatus,
  fetchAiStatus,
  fetchRetrievalStatus,
  rebuildSearchIndex,
} from "@/services/api";
import { SessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";

/** Grouped settings are one of the few places a Card genuinely earns its keep. */
function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="border-b border-border pb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="pt-4">{children}</div>
    </Card>
  );
}

import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";

export function SettingsPage({ user }: { user: SessionUser | null }) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_SETTINGS.apiUrl);
  const [retrieval, setRetrieval] = useState<RetrievalStatus | null>(null);
  const [retrievalLoading, setRetrievalLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<ReindexResult | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Restore whatever was saved on this machine; defaults apply otherwise.
  useEffect(() => {
    const saved = loadSettings();
    setApiUrl(saved.apiUrl);
  }, []);

  // The provider is the backend's to decide; this page only reports it.
  useEffect(() => {
    let active = true;
    fetchAiStatus()
      .then((status) => active && setAi(status))
      .finally(() => active && setAiLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // The index's state is the backend's to report, same as the provider.
  useEffect(() => {
    let active = true;
    fetchRetrievalStatus()
      .then((status) => active && setRetrieval(status))
      .finally(() => active && setRetrievalLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleBuildIndex = async () => {
    setIndexing(true);
    setIndexError(null);
    setIndexResult(null);
    try {
      const result = await rebuildSearchIndex();
      setIndexResult(result);
      // Re-read rather than trusting the write: what /health reports is what
      // the rest of the platform will actually answer from.
      setRetrieval(await fetchRetrievalStatus());
    } catch (err) {
      setIndexError(
        err instanceof ApiError ? err.message : "Could not build the index."
      );
    } finally {
      setIndexing(false);
    }
  };

  const handleSave = () => {
    const ok = saveSettings({ apiUrl });
    if (ok) {
      setSaveError(null);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } else {
      setIsSaved(false);
      setSaveError("Could not save — browser storage is unavailable.");
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title="Settings"
        description="Backend connection, extraction model and OCR ingestion thresholds."
      />

      <Section className="space-y-4">
        <SettingsGroup
          title="Backend connection"
          description="Host for document processing endpoints and PDF retrieval."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="api-url">API base URL</Label>
              <Input
                id="api-url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conn-mode">Connection mode</Label>
              <div
                id="conn-mode"
                className="flex h-8 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground"
              >
                Auto-fallback
              </div>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Extraction engine"
          description="Which model answers, as reported by the backend. Configured server-side so a key never reaches the browser."
        >
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="model">Active provider</Label>
              <div
                id="model"
                className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm"
              >
                {aiLoading ? (
                  <span className="text-muted-foreground">Checking…</span>
                ) : !ai ? (
                  <span className="text-muted-foreground">Backend unreachable</span>
                ) : (
                  <>
                    <Badge variant={ai.ai_mode === "mock" ? "outline" : "default"}>
                      {ai.ai_mode}
                    </Badge>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {ai.ai_model ?? "deterministic stand-in answers"}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {ai?.ai_mode_reason
                  ? ai.ai_mode_reason
                  : "Set by the backend's .env — see .env.example for the options."}
              </p>
            </div>

          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Semantic search index"
          description="Passages embedded for meaning-based retrieval, so a question finds the right paragraph rather than the right keyword."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </dt>
                <dd className="mt-1">
                  {retrievalLoading ? (
                    <span className="text-sm text-muted-foreground">Checking…</span>
                  ) : !retrieval ? (
                    <span className="text-sm text-muted-foreground">Backend unreachable</span>
                  ) : (
                    <Badge variant={retrieval.enabled ? "default" : "outline"}>
                      {retrieval.enabled ? "Active" : "Not available"}
                    </Badge>
                  )}
                </dd>
              </div>
              {[
                ["Indexed reports", retrieval ? String(retrieval.indexed_reports) : "\u2014"],
                ["Indexed passages", retrieval ? String(retrieval.indexed_chunks) : "\u2014"],
                ["Embedding model", retrieval?.embedding_model ?? "\u2014"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 truncate font-mono text-sm text-foreground" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </div>

            {/* When it is off, the reason is the useful part - "not available"
                alone leaves an operator with nowhere to go. */}
            {retrieval && !retrieval.enabled && (
              <p className="text-xs text-muted-foreground">
                {retrieval.index_reason ?? retrieval.embeddings_reason ?? "No reason reported."}
              </p>
            )}

            {retrieval?.enabled && retrieval.indexed_chunks === 0 && !indexResult && (
              <p className="text-xs text-muted-foreground">
                The index is reachable but empty. Build it to answer questions from
                passages rather than from the opening of each document.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button
                onClick={handleBuildIndex}
                disabled={indexing || !!user?.readonly}
                title={
                  user?.readonly
                    ? "The demo account is read-only. Every passage costs an embedding call."
                    : "Embed every stored report so questions can be answered from the passages that matter"
                }
              >
                {indexing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Database className="h-3.5 w-3.5" />
                )}
                {indexing ? "Building index…" : "Build search index"}
              </Button>

              <span className="text-xs text-muted-foreground">
                {user?.readonly
                  ? "Read-only account — sign in with a writing account to build the index."
                  : indexing
                    ? "Embedding every stored report. This can take a minute or two."
                    : "Re-runnable: a report already indexed is replaced, not duplicated."}
              </span>
            </div>

            {indexError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive-muted p-3 text-xs text-destructive"
              >
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                {indexError}
              </p>
            )}

            {indexResult && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <p className="text-foreground">
                  Indexed{" "}
                  <span className="font-mono font-medium">{indexResult.reports_indexed}</span> of{" "}
                  <span className="font-mono font-medium">{indexResult.reports_seen}</span> reports
                  into{" "}
                  <span className="font-mono font-medium">{indexResult.chunks_indexed}</span>{" "}
                  passages.
                </p>
                {/* Named rather than counted: "3 failed" is not something an
                    operator can act on. */}
                {indexResult.failures.length > 0 && (
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {indexResult.failures.map((failure) => (
                      <li key={failure.report_id}>
                        <span className="font-mono">{failure.filename}</span> — {failure.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </SettingsGroup>

        <SettingsGroup title="Platform">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {[
              ["Problem statement", "SIH26023"],
              ["Organisation", "Ministry of Coal / CMPDI"],
              ["Frontend", "React 18 · Vite · TS"],
              ["Design system", "shadcn/ui"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </SettingsGroup>
      </Section>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        {saveError && (
          <span role="alert" className="text-xs text-destructive">
            {saveError}
          </span>
        )}
        {isSaved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            Configuration saved
          </span>
        )}
        <Button onClick={handleSave}>
          <Save className="h-3.5 w-3.5" />
          Save configuration
        </Button>
      </div>
    </div>
  );
}
