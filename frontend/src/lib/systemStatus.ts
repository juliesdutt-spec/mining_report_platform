import { AiStatus, RetrievalStatus, SystemStatus } from "@/services/api";

/**
 * The sign-in screen's status panel, as data.
 *
 * Kept apart from the page so it can be driven through a degraded backend in a
 * test. That is the whole point of it: a status display that cannot go amber is
 * decoration, and this platform's own claim is that it says when something is
 * off. Every row below is derived from something /health reported.
 */

export type StatusTone = "ok" | "warn" | "down" | "idle";

export interface StatusRow {
  label: string;
  value: string;
  tone: StatusTone;
  /** The operator's full reason, shown on hover. Settings shows it as text. */
  detail?: string | null;
}

export const STATUS_LABELS = [
  "API",
  "Document engine",
  "Semantic search",
  "Evidence retrieval",
] as const;

function engineRow(ai: AiStatus | null): StatusRow {
  // "mock" is not a failure - the platform runs with no credentials at all by
  // design - but it is not the real thing either, and a green dot over
  // deterministic stand-ins would be the exact lie this panel exists to avoid.
  if (!ai || ai.ai_mode === "mock") {
    return {
      label: "Document engine",
      value: "Stand-in mode",
      tone: "warn",
      detail: ai?.ai_mode_reason ?? null,
    };
  }
  return {
    label: "Document engine",
    value: "Operational",
    tone: "ok",
    detail: ai.ai_model ? `${ai.ai_mode} · ${ai.ai_model}` : ai.ai_mode,
  };
}

function searchRow(retrieval: RetrievalStatus | null): StatusRow {
  if (retrieval?.enabled && retrieval.indexed_chunks > 0) {
    return {
      label: "Semantic search",
      value: "Operational",
      tone: "ok",
      detail: `${retrieval.indexed_reports} reports · ${retrieval.indexed_chunks} passages`,
    };
  }
  if (retrieval?.enabled) {
    // Reachable and able to embed, with nothing in it yet. Worth separating
    // from "unavailable": the fix is one button in Settings, not a deployment.
    return { label: "Semantic search", value: "Index empty", tone: "warn" };
  }
  return {
    label: "Semantic search",
    value: "Unavailable",
    tone: "warn",
    detail: retrieval?.index_reason ?? retrieval?.embeddings_reason ?? null,
  };
}

export function statusRows(status: SystemStatus | null): StatusRow[] {
  if (status === null) {
    return STATUS_LABELS.map((label) => ({
      label,
      value: "Checking…",
      tone: "idle" as const,
    }));
  }

  if (!status.online) {
    // Nothing else can be claimed from here. Reporting the other three as
    // operational while the API is unreachable is how a status panel stops
    // being worth reading.
    return STATUS_LABELS.map((label) =>
      label === "API"
        ? { label, value: "Unreachable", tone: "down" as const }
        : { label, value: "Unknown", tone: "idle" as const }
    );
  }

  return [
    { label: "API", value: "Operational", tone: "ok" },
    engineRow(status.ai),
    searchRow(status.retrieval),
    {
      // The one row with no separate probe, and it needs none: evidence is
      // located in-process over text already stored, so it is up exactly when
      // the API is up.
      label: "Evidence retrieval",
      value: "Operational",
      tone: "ok",
      detail: "Runs in-process over stored document text.",
    },
  ];
}
