// Base API configuration for DataForge.
//
// Every response shape below is derived from backend/api.py — do not change one
// without checking the corresponding endpoint.
import { BUILT_IN_API_URL, savedApiUrl } from '@/lib/settings';

/**
 * Where to send requests, resolved per call.
 *
 * The Settings page offers an API base URL, so that value has to be the one
 * actually used — otherwise the field would report a backend the app never
 * talks to. An unset override falls through to the build-time VITE_API_URL.
 * Read per request rather than once, so saving in Settings takes effect
 * without a reload.
 */
function apiBaseUrl(): string {
  return savedApiUrl() ?? BUILT_IN_API_URL;
}

/** Raised for any non-2xx response or transport failure. */
export class ApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Fetch JSON from the backend, surfacing FastAPI's `detail` message on failure.
 * Uploads and AI queries are slow, so callers pass a generous timeout.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 30000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('The backend took too long to respond. Is it still processing?');
    }
    throw new ApiError(
      `Cannot reach the DataForge backend at ${apiBaseUrl()}. Start it with: uvicorn backend.api:app --reload`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // FastAPI reports errors as { detail: string }.
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* response had no JSON body — keep the status line */
    }
    throw new ApiError(detail, res.status);
  }

  return (await res.json()) as T;
}

export async function checkBackendHealth(): Promise<{ isOnline: boolean; statusText: string }> {
  try {
    const data = await apiFetch<{ status?: string }>('/health', undefined, 1800);
    return { isOnline: true, statusText: `FastAPI Live (${data.status ?? 'ok'})` };
  } catch {
    return { isOnline: false, statusText: 'Backend Offline' };
  }
}

/** Which model is answering, as reported by GET /health. Never includes a key. */
export interface AiStatus {
  /** Live provider name, or "mock" when answers are deterministic stand-ins. */
  ai_mode: string;
  ai_model: string | null;
  /** Present only in mock mode: what is missing, in an operator's terms. */
  ai_mode_reason: string | null;
  ai_provider_requested: string;
  ai_providers_available: string[];
}

/**
 * Read the active AI provider.
 *
 * The model in play is decided by the backend's environment, never by the
 * browser, so Settings reports this rather than offering a choice it could
 * not honour. Returns null when the backend is unreachable.
 */
export async function fetchAiStatus(): Promise<AiStatus | null> {
  try {
    return await apiFetch<AiStatus>('/health', undefined, 5000);
  } catch {
    return null;
  }
}

/* ---------- Backend response contracts (see backend/api.py) ---------- */

/** The AI extraction payload — schema defined in ai_extractor.extract_structured_data. */
export interface BackendExtractedData {
  report_date?: string | null;
  location?: string | null;
  district?: string | null;
  state?: string | null;
  mineral_type?: string | null;
  quantity_extracted?: string | null;
  extraction_method?: string | null;
  company_name?: string | null;
  mine_name?: string | null;
  area_sq_km?: string | null;
  reserve_estimate?: string | null;
  summary?: string | null;
  key_findings?: string[] | null;
  topics?: string[] | null;
  minerals_mentioned?: string[] | null;
  locations_mentioned?: string[] | null;
  financial_data?: string | null;
  environmental_notes?: string | null;
}

/** GET /reports -> reports[] */
export interface BackendReportListItem {
  id: number;
  filename: string;
  upload_date: string | null;
  status: string;
  mineral_type: string | null;
  location: string | null;
  quantity_extracted: string | null;
  summary: string | null;
  topics: string[] | null;
  company_name?: string | null;
  mine_name?: string | null;
}

export interface BackendReportListResponse {
  total: number;
  reports: BackendReportListItem[];
}

/** GET /reports/{id} */
/** A passage located in the document's text (evidence_locator.locate_evidence). */
export interface BackendEvidence {
  id: string;
  documentId: number;
  documentName: string;
  field: string;
  sectionHeader: string;
  extractedValue: string;
  pageNumber: number;
  originalContext: string;
}

export interface BackendReportDetail extends BackendReportListItem {
  extracted_data: BackendExtractedData | null;
  report_date: string | null;
  extraction_method: string | null;
  company_name: string | null;
  mine_name: string | null;
  word_cloud_available: boolean;
  error_message: string | null;
  evidence?: BackendEvidence[];
  page_count?: number | null;
}

/** POST /upload */
export interface BackendUploadResponse {
  id: number;
  filename: string;
  status: string;
  extracted_data: BackendExtractedData | null;
  word_cloud_available: boolean;
  message: string;
}

/** POST /query — note: `question` is a QUERY PARAMETER, not a JSON body. */
export interface BackendQueryResponse {
  /** Which model answered: a provider name, or "mock". */
  answer_source?: string;
  /** Why the answer is a stand-in, when a provider failed. Never carries a key. */
  answer_note?: string | null;
  question: string;
  answer: string;
  reports_used: number;
  report_ids?: number[];
  /** Passages located in the reports the answer drew on. */
  evidence?: BackendEvidence[];
  sources?: { id: number; filename: string }[];
}

/** GET /query-history */
export interface BackendQueryHistoryResponse {
  queries: {
    id: number;
    question: string;
    answer: string;
    created_at: string | null;
  }[];
}

/** GET /stats */
export interface BackendStats {
  total_reports: number;
  completed: number;
  errors: number;
  total_queries: number;
  mineral_distribution: Record<string, number>;
  location_distribution: Record<string, number>;
}

/**
 * GET /reports/{id}/download — the backend streams a generated PDF
 * (report_generator.generate_pdf_report). Returned as a URL so the browser
 * can download it directly rather than buffering it through JS.
 *
 * Pass `inline` for an embedded preview. A browser honours
 * `Content-Disposition: attachment` inside an <object> too, so embedding the
 * download URL saves a file every time the element mounts instead of
 * rendering the document.
 */
export function reportDownloadUrl(
  reportId: number,
  options: { inline?: boolean } = {}
): string {
  const suffix = options.inline ? '?inline=true' : '';
  return `${apiBaseUrl()}/reports/${reportId}/download${suffix}`;
}

/**
 * GET /reports/{id}/wordcloud — the backend renders a PNG from the report's
 * stored raw text (wordcloud_generator.generate_word_cloud_bytes). Returns a
 * URL so the browser fetches the image directly.
 *
 * Note: 400 when the report has no extractable text or the render fails, and
 * 404 when the report is gone — callers should treat both as "unavailable".
 */
export function reportWordCloudUrl(reportId: number): string {
  return `${apiBaseUrl()}/reports/${reportId}/wordcloud`;
}

/**
 * POST /reports/generate — composes a dossier PDF across all completed reports.
 * Returned as a URL so the browser downloads it directly.
 */
export function dossierUrl(options: {
  title: string;
  period: string;
  execSummary: boolean;
  productionOverview: boolean;
  keyFindings: boolean;
  sourceReferences: boolean;
  /** Container for the same dossier. Defaults to PDF. */
  format?: 'pdf' | 'docx';
}): string {
  const params = new URLSearchParams({
    title: options.title,
    period: options.period,
    exec_summary: String(options.execSummary),
    production_overview: String(options.productionOverview),
    key_findings: String(options.keyFindings),
    source_references: String(options.sourceReferences),
    format: options.format ?? 'pdf',
  });
  return `${apiBaseUrl()}/reports/generate?${params.toString()}`;
}

export { apiBaseUrl };
