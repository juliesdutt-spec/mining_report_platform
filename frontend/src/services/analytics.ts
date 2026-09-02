import { KpiMetrics, ProductionDataPoint } from '../types';
import { INITIAL_KPIS, MOCK_PRODUCTION_TRENDS } from './mockData';

export async function fetchKpiMetrics(): Promise<KpiMetrics> {
  return { ...INITIAL_KPIS };
}

export async function fetchProductionTrends(interval: '3m' | '30d' | '7d'): Promise<ProductionDataPoint[]> {
  return MOCK_PRODUCTION_TRENDS[interval] || MOCK_PRODUCTION_TRENDS['3m'];
}
