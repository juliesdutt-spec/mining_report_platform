// Base API configuration for DataForge.
//
// Every response shape below is derived from backend/api.py — do not change one
// without checking the corresponding endpoint.
import { BUILT_IN_API_URL, savedApiUrl } from '@/lib/settings';
import { clearToken, getToken, setToken, SessionUser } from '@/lib/session';

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

/**
 * What to say when the backend cannot be reached.
 *
 * The uvicorn hint only helps someone running the stack on their own machine.
 * Told to a visitor on a deployed site - or on a phone - it names a command
 * they cannot run on a host they do not have, so the advice is withheld unless
 * the address really is their own machine.
 */
function unreachableMessage(base: string): string {
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(base);
  return isLocal
    ? `Cannot reach the DataForge backend at ${base}. Start it with: uvicorn backend.api:app --reload`
    : `Cannot reach the DataForge backend at ${base}. It may be starting up, or offline - retry in a moment. You can point the app elsewhere in Settings.`;
}

/**
 * Add the session token to a request's headers.
 *
 * Kept separate from apiFetch because the file-fetching helpers below need the
 * same header: a browser cannot attach one to an <img src> or a download link,
 * which is why those now go through fetch instead of a bare URL.
 */
function withAuth(existing?: HeadersInit): Headers {
  const headers = new Headers(existing);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

/**
 * A 401 means the session is over - expired, or the account was removed.
 *
 * Clearing it here rather than at each call site is what makes the app fall
 * back to the sign-in screen instead of showing a signed-in shell over an API
 * that refuses everything.
 */
function handleUnauthorized(status: number): void {
  if (status === 401 && getToken()) clearToken();
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
    res = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: withAuth(init?.headers),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('The backend took too long to respond. Is it still processing?');
    }
    throw new ApiError(unreachableMessage(apiBaseUrl()));
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    handleUnauthorized(res.status);
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
  // The document, explorer and report tables all have columns for these.
  // The list endpoint did not send them, so those columns rendered an em
  // dash on every row while the values sat in the database.
  extraction_method?: string | null;
  reserve_estimate?: string | null;
  report_date?: string | null;
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
/**
 * How good the extraction is, as two separate figures.
 *
 * `completeness` is coverage — how many of the fields the platform depends on
 * came back populated. It is computable from the live corpus and says nothing
 * about whether those values are right.
 *
 * `measured` is accuracy, and only exists once someone has scored extraction
 * against hand-read documents (`python -m evaluation.score --json`). It is
 * null until then, and the UI says so rather than showing coverage in its
 * place — they measure different things.
 */
export interface ExtractionQuality {
  fields: string[];
  completeness: {
    documents: number;
    fieldsExpected: number;
    fieldsPopulated: number;
    ratio: number | null;
  };
  measured: {
    accuracy: number;
    fieldsScored: number;
    documents: number;
    exact: number;
    equivalent: number;
    missing: number;
    wrong: number;
  } | null;
}

export interface BackendStats {
  total_reports: number;
  completed: number;
  errors: number;
  total_queries: number;
  extraction_quality?: ExtractionQuality;
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
export function dossierPath(options: {
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
  return `/reports/generate?${params.toString()}`;
}

/* ------------------------------------------------------------------ auth */

export interface LoginResult {
  access_token: string;
  token_type: string;
  user: SessionUser;
}

/** Exchange credentials for a session. Stores the token on success. */
export async function login(username: string, password: string): Promise<SessionUser> {
  const result = await apiFetch<LoginResult>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  setToken(result.access_token);
  return result.user;
}

/** Who the stored token belongs to, or null if it is no longer valid. */
export async function fetchCurrentUser(): Promise<SessionUser | null> {
  if (!getToken()) return null;
  try {
    return await apiFetch<SessionUser>('/auth/me');
  } catch {
    // apiFetch has already cleared the token on a 401; a transport failure
    // should not sign someone out, but it cannot confirm them either.
    return null;
  }
}

export interface DemoCredentials {
  enabled: boolean;
  username?: string;
  password?: string;
}

/** The published demo login, shown on the sign-in page. */
export async function fetchDemoCredentials(): Promise<DemoCredentials> {
  try {
    return await apiFetch<DemoCredentials>('/auth/demo');
  } catch {
    return { enabled: false };
  }
}

/* --------------------------------------------------- authenticated files */

export interface FetchedFile {
  /** An object URL, valid until revoke() is called. */
  url: string;
  filename: string;
  revoke: () => void;
}

/**
 * Fetch a file the browser would otherwise load by URL alone.
 *
 * <img src>, <object data> and <a download> cannot carry an Authorization
 * header, so every one of them would now be refused. Fetching the bytes here
 * and handing back an object URL keeps the token in a header where it belongs,
 * rather than putting it in a URL that ends up in logs and Referer headers.
 */
export async function fetchFile(path: string): Promise<FetchedFile> {
  const res = await fetch(`${apiBaseUrl()}${path}`, { headers: withAuth() });
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new ApiError(`${res.status} ${res.statusText}`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { url, filename: filenameFrom(res.headers), revoke: () => URL.revokeObjectURL(url) };
}

/** Fetch a file and hand it to the browser as a download. */
export async function saveFile(path: string, fallbackName: string): Promise<void> {
  const file = await fetchFile(path);
  const anchor = document.createElement('a');
  anchor.href = file.url;
  anchor.download = file.filename || fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers; the next
  // tick is after the click has been handled.
  setTimeout(file.revoke, 0);
}

/**
 * The server's filename for a download.
 *
 * The header is built per RFC 6266, so the real name is in filename* as
 * percent-encoded UTF-8 and the quoted filename is a reduced ASCII fallback.
 * Prefer the former; fall back rather than throw on anything unexpected.
 */
function filenameFrom(headers: Headers): string {
  const header = headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      /* Malformed encoding - fall through to the ASCII form. */
    }
  }
  const quoted = /filename="([^"]*)"/i.exec(header);
  return quoted ? quoted[1] : '';
}

export { apiBaseUrl };
