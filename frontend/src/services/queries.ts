import { QueryResult } from '../types';
import { MOCK_QUERY_RESULTS, MOCK_DOCUMENTS } from './mockData';

let queryState: QueryResult[] = [...MOCK_QUERY_RESULTS];

export async function askDataForgeQuery(query: string): Promise<QueryResult> {
  // Simulate AI answering grounded in indexed documents
  const newResult: QueryResult = {
    id: `q-${Date.now()}`,
    question: query,
    answer: `Grounded analysis of indexed CMPDI & CIL subsidiary documents for query "${query}": Analysis across 4 indexed production reports indicates aggregate raw coal yield reached 102.12 MT across SECL and NCL operational corridors. Operational stripping ratios maintained a stable composite average of 1.18 m³/t with environmental clearances verified under current MoEFCC statutory guidelines.`,
    keyFindings: [
      "Proved reserves across surveyed Talcher Block V and Gevra sectors total 1,650.20 MT.",
      "First-Mile Connectivity (FMC) projects reduced truck-haul carbon footprints by 28%.",
      "Prime coking coal recovery at Moonidih (BCCL) logged 1.42 MT using powered roof supports."
    ],
    evidence: [
      {
        id: `qev-${Date.now()}-1`,
        documentId: 1,
        documentName: "SECL_Gevra_Annual_Production_2023_24.pdf",
        pageNumber: 14,
        sectionHeader: "3.2 Annual Production Metrics",
        field: "coal_production_mt",
        extractedValue: "52.50 MT",
        originalContext: "Total raw coal excavated during the operational cycle FY 2023-24 reached 52.50 MT.",
        confidence: 0.99
      },
      {
        id: `qev-${Date.now()}-2`,
        documentId: 2,
        documentName: "BCCL_Jharia_Seam_XVI_Geological_Survey.pdf",
        pageNumber: 38,
        sectionHeader: "Borehole Assay Summary",
        field: "coking_coal_yield",
        extractedValue: "1.42 MT",
        originalContext: "Mechanized Longwall face output yielded 1,420,000 MT of Prime Coking Coal.",
        confidence: 0.98
      }
    ],
    sourceDocuments: [
      { id: 1, filename: "SECL_Gevra_Annual_Production_2023_24.pdf", pageNumbers: [14, 22], relevanceScore: 0.98 },
      { id: 2, filename: "BCCL_Jharia_Seam_XVI_Geological_Survey.pdf", pageNumbers: [38], relevanceScore: 0.94 },
      { id: 4, filename: "NCL_Jayant_Expansion_Review_FY24.pdf", pageNumbers: [19], relevanceScore: 0.91 }
    ],
    timestamp: new Date().toISOString()
  };

  queryState = [newResult, ...queryState];
  return newResult;
}

export async function fetchRecentQueries(): Promise<QueryResult[]> {
  return queryState;
}
