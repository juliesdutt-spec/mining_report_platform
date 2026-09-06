import { apiFetch, BackendStats } from './api';
import { OrganisationFilter } from '../types';

/**
 * GET /stats — real counts from the reports database.
 *
 * The backend models document counts and query counts only. It has no concept
 * of automation rate, extraction accuracy, pages processed or time saved, so
 * those former dashboard figures are gone rather than invented.
 *
 * Passing an organisation scopes every count and distribution to it, so a
 * filtered view never shows one organisation's charts beside global totals.
 */
export async function fetchPlatformStats(
  organisation: OrganisationFilter = 'ALL'
): Promise<BackendStats> {
  const query =
    organisation === 'ALL' ? '' : `?organisation=${encodeURIComponent(organisation)}`;
  return apiFetch<BackendStats>(`/stats${query}`);
}
