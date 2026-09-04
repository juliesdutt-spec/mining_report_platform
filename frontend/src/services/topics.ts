import { TopicEntity } from '../types';
import { apiFetch, BackendReportListResponse } from './api';

/**
 * Topics are derived from the real `topics` array the AI extractor produces for
 * each uploaded report (see ai_extractor.extract_structured_data), aggregated
 * across everything in GET /reports.
 *
 * There is no topic-modelling endpoint, so weight is simply how many indexed
 * documents mention the term, normalised to 0-100. `trendPercent` and
 * `relatedTerms` have no backend source: trend is reported as 0 rather than
 * invented, and related terms are the other topics that genuinely co-occur in
 * the same documents.
 */
export async function fetchTopics(): Promise<TopicEntity[]> {
  const data = await apiFetch<BackendReportListResponse>('/reports?limit=100');
  const reports = data.reports ?? [];

  // term -> the document ids that mention it
  const byTerm = new Map<string, number[]>();
  for (const report of reports) {
    for (const raw of report.topics ?? []) {
      const term = raw?.trim();
      if (!term) continue;
      const ids = byTerm.get(term) ?? [];
      if (!ids.includes(report.id)) ids.push(report.id);
      byTerm.set(term, ids);
    }
  }
  if (byTerm.size === 0) return [];

  const maxCount = Math.max(...[...byTerm.values()].map((ids) => ids.length));

  return [...byTerm.entries()]
    .map(([name, documentIds]) => ({
      id: `topic-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      weight: Math.round((documentIds.length / maxCount) * 100),
      category: categorise(name),
      trendPercent: 0, // no historical data server-side
      relatedTerms: coOccurring(name, documentIds, byTerm),
      documentCount: documentIds.length,
      documentIds,
    }))
    .sort((a, b) => b.documentCount - a.documentCount || a.name.localeCompare(b.name));
}

/** Best-effort bucketing for the existing category filter, from the term itself. */
function categorise(term: string): TopicEntity['category'] {
  const t = term.toLowerCase();
  if (/(safety|hazard|dgms|methane|risk|incident)/.test(t)) return 'safety';
  if (/(environment|reclamation|emission|pollution|moefcc|ecolog)/.test(t)) return 'environment';
  if (/(coal|ore|mineral|lignite|seam|reserve|grade)/.test(t)) return 'mineral';
  if (/(basin|block|region|district|state|field)/.test(t)) return 'location';
  return 'operation';
}

/** Other terms that appear in at least one of the same documents. */
function coOccurring(
  name: string,
  documentIds: number[],
  byTerm: Map<string, number[]>
): string[] {
  const related: string[] = [];
  for (const [other, ids] of byTerm) {
    if (other === name) continue;
    if (ids.some((id) => documentIds.includes(id))) related.push(other);
    if (related.length >= 6) break;
  }
  return related;
}
