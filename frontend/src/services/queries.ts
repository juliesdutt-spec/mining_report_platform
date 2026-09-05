import { OrganisationFilter, QueryResult } from '../types';
import {
  apiFetch,
  BackendQueryHistoryResponse,
  BackendQueryResponse,
  BackendReportListResponse,
} from './api';

/**
 * POST /query
 *
 * The backend takes `question` as a QUERY PARAMETER (not a JSON body) — see
 * `query_mining_reports` in backend/api.py — and answers using every completed
 * report as context, narrowed to one organisation when a scope is selected.
 * Alongside the answer it returns the passages it could locate in those
 * reports and the documents they came from.
 *
 * Relevance scores and key findings are still not modelled server-side, so
 * those stay empty rather than being synthesised to fill the UI.
 */
export async function askDataForgeQuery(
  question: string,
  organisation: OrganisationFilter = 'ALL'
): Promise<QueryResult> {
  const params = new URLSearchParams({ question });
  if (organisation !== 'ALL') params.set('organisation', organisation);

  const res = await apiFetch<BackendQueryResponse>(
    `/query?${params.toString()}`,
    { method: 'POST' },
    120000
  );

  // Prefer the named sources the backend returns; fall back to resolving ids.
  const sourceDocuments = res.sources?.length
    ? res.sources.map((s) => ({ id: s.id, filename: s.filename }))
    : await resolveSourceDocuments(res.report_ids);

  return {
    id: `q-${Date.now()}`,
    question: res.question ?? question,
    answer: res.answer,
    keyFindings: [],
    // Real passages located in the source documents; empty when none verify.
    evidence: (res.evidence ?? []).map((e) => ({
      id: e.id,
      documentId: e.documentId,
      documentName: e.documentName,
      pageNumber: e.pageNumber,
      sectionHeader: e.sectionHeader,
      field: e.field,
      extractedValue: e.extractedValue,
      originalContext: e.originalContext,
    })),
    sourceDocuments,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Turn the report IDs the answer used into named sources.
 * Falls back to the bare IDs if the report list can't be fetched.
 */
async function resolveSourceDocuments(
  reportIds: number[] | undefined
): Promise<QueryResult['sourceDocuments']> {
  if (!reportIds?.length) return [];

  try {
    const list = await apiFetch<BackendReportListResponse>('/reports?limit=100');
    const byId = new Map(list.reports.map((r) => [r.id, r.filename]));
    return reportIds.map((id) => ({
      id,
      filename: byId.get(id) ?? `Report #${id}`,
    }));
  } catch {
    return reportIds.map((id) => ({ id, filename: `Report #${id}` }));
  }
}

/**
 * GET /query-history — past questions and answers.
 * History rows carry no source IDs, so their source lists are empty.
 */
export async function fetchRecentQueries(): Promise<QueryResult[]> {
  const data = await apiFetch<BackendQueryHistoryResponse>('/query-history?limit=20');
  return (data.queries ?? []).map((q) => ({
    id: `qh-${q.id}`,
    question: q.question,
    answer: q.answer,
    keyFindings: [],
    evidence: [],
    sourceDocuments: [],
    timestamp: q.created_at ?? new Date().toISOString(),
  }));
}
