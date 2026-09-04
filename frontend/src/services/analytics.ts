import { ProductionDataPoint } from '../types';
import { MOCK_PRODUCTION_TRENDS } from './mockData';
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

/**
 * NOT BACKED BY THE API. The backend exposes no production time-series
 * endpoint, so this remains illustrative sample data. Out of scope for the
 * current integration work — see the Dashboard's own caveat.
 */
export async function fetchProductionTrends(
  interval: '3m' | '30d' | '7d'
): Promise<ProductionDataPoint[]> {
  return MOCK_PRODUCTION_TRENDS[interval] || MOCK_PRODUCTION_TRENDS['3m'];
}
