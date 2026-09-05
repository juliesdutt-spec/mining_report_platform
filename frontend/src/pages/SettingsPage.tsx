import React, { useEffect, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { AiStatus, fetchAiStatus } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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

export function SettingsPage() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_SETTINGS.apiUrl);
  const [ocrConfidence, setOcrConfidence] = useState(DEFAULT_SETTINGS.ocrConfidence);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Restore whatever was saved on this machine; defaults apply otherwise.
  useEffect(() => {
    const saved = loadSettings();
    setApiUrl(saved.apiUrl);
    setOcrConfidence(saved.ocrConfidence);
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

  const handleSave = () => {
    const ok = saveSettings({ apiUrl, ocrConfidence });
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="ocr-threshold">OCR confidence threshold</Label>
                <span className="font-mono text-sm tabular-nums font-medium text-foreground">
                  {ocrConfidence}%
                </span>
              </div>
              <Slider
                id="ocr-threshold"
                min={60}
                max={98}
                step={1}
                value={[ocrConfidence]}
                onValueChange={([v]) => setOcrConfidence(v)}
                className="pt-2"
              />
              <p className="text-xs text-muted-foreground">
                Extractions below this score are routed to Validation.
              </p>
            </div>
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
