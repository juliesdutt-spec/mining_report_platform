import { QueryResult } from '../types';
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
 * report as context.
 *
 * It returns only `{ question, answer, reports_used, report_ids }`. There are no
 * passage-level citations, page numbers or relevance scores, so `evidence` and
 * `keyFindings` come back empty and `sourceDocuments` carries just the real
 * documents the answer drew on. Nothing here is synthesised to fill the UI.
 */
export async function askDataForgeQuery(question: string): Promise<QueryResult> {
  const res = await apiFetch<BackendQueryResponse>(
    `/query?question=${encodeURIComponent(question)}`,
    { method: 'POST' },
    120000
  );

  const sourceDocuments = await resolveSourceDocuments(res.report_ids);

  return {
    id: `q-${Date.now()}`,
    question: res.question ?? question,
    answer: res.answer,
    keyFindings: [],
    evidence: [],
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
