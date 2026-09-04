import React, { useEffect, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [modelName, setModelName] = useState(DEFAULT_SETTINGS.modelName);
  const [ocrConfidence, setOcrConfidence] = useState(DEFAULT_SETTINGS.ocrConfidence);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Restore whatever was saved on this machine; defaults apply otherwise.
  useEffect(() => {
    const saved = loadSettings();
    setApiUrl(saved.apiUrl);
    setModelName(saved.modelName);
    setOcrConfidence(saved.ocrConfidence);
  }, []);

  const handleSave = () => {
    const ok = saveSettings({ apiUrl, modelName, ocrConfidence });
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
          description="Model used for summarisation, entity tagging and grounded answers."
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Select value={modelName} onValueChange={setModelName}>
                <SelectTrigger id="model" className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-opus-5">claude-opus-5</SelectItem>
                  <SelectItem value="claude-sonnet-5">claude-sonnet-5</SelectItem>
                  <SelectItem value="claude-haiku-4-5">claude-haiku-4-5</SelectItem>
                  <SelectItem value="mock-ai-engine">Deterministic mock engine</SelectItem>
                </SelectContent>
              </Select>
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
