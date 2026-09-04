import { apiFetch, BackendStats } from './api';

/**
 * GET /stats — real counts from the reports database.
 *
 * The backend models document counts and query counts only. It has no concept
 * of automation rate, extraction accuracy, pages processed or time saved, so
 * those former dashboard figures are gone rather than invented.
 */
export async function fetchPlatformStats(): Promise<BackendStats> {
  return apiFetch<BackendStats>('/stats');
}

