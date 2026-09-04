import { ValidationItem } from '../types';
import { apiFetch } from './api';

/** GET /validation — findings the backend computes from the stored reports. */
export interface ValidationResponse {
  counts: { total: number; pending: number; resolved: number; high: number };
  findings: ValidationItem[];
}

export async function fetchValidation(): Promise<ValidationResponse> {
  return apiFetch<ValidationResponse>('/validation');
}

/**
 * POST /validation/{id}/resolve — record an auditor's decision.
 * Pass status 'pending' to reopen a previously resolved finding.
 */
export async function resolveValidationFinding(
  findingId: string,
  status: 'resolved' | 'flagged' | 'pending',
  note?: string
): Promise<void> {
  const params = new URLSearchParams({ status });
  if (note) params.set('note', note);
  await apiFetch(
    `/validation/${encodeURIComponent(findingId)}/resolve?${params.toString()}`,
    { method: 'POST' }
  );
}
