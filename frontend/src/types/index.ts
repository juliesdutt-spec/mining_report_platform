export type NavigationTab = 
  | 'dashboard'
  | 'documents'
  | 'ask'
  | 'analytics'
  | 'topics'
  | 'reports'
  | 'explorer'
  | 'validation'
  | 'settings';

export type Subsidiary = 
  | 'ECL' 
  | 'BCCL' 
  | 'CCL' 
  | 'WCL' 
  | 'SECL' 
  | 'MCL' 
  | 'NCL' 
  | 'CMPDI';

export type ValidationStatus = 'validated' | 'needs_review' | 'conflicting' | 'low_confidence';

export interface EvidenceSnippet {
  id: string;
  documentId: number | string;
  documentName: string;
  pageNumber: number;
  sectionHeader: string;
  field: string;
  extractedValue: string;
  originalContext: string;
  confidence: number;
}

export interface MiningDocument {
  id: number;
  filename: string;
  fileType: 'PDF' | 'DOCX' | 'XLSX' | 'IMAGE';
  fileSizeBytes: number;
  pageCount: number;
  uploadDate: string;
  status: 'processing' | 'completed' | 'error' | 'pending';
  confidenceScore: number;
  subsidiary: Subsidiary;
  mineName: string;
  location: string;
  district: string;
  state: string;
  mineralType: string;
  quantityExtracted: string;
  extractionMethod: 'Opencast' | 'Underground' | 'Mixed';
  reserveEstimate: string;
  topics: string[];
  summary: string;
  keyFindings?: string[];
  rawText?: string;
  evidenceSnippets: EvidenceSnippet[];
  validationStatus: ValidationStatus;
}

export interface KpiMetrics {
  documentsProcessed: number;
  pagesProcessed: number;
  recordsExtracted: number;
  reportsGenerated: number;
  queriesAnswered: number;
  automationRate: number;
  extractionAccuracy: number;
  processingTimeSavedHours: number;
}

export interface ProductionDataPoint {
  date: string;
  actual: number;
  target: number;
  opencast: number;
  underground: number;
}

export interface QueryResult {
  id: string;
  question: string;
  answer: string;
  keyFindings: string[];
  evidence: EvidenceSnippet[];
  sourceDocuments: {
    id: number;
    filename: string;
    pageNumbers: number[];
    relevanceScore: number;
  }[];
  timestamp: string;
}

export interface TopicEntity {
  id: string;
  name: string;
  weight: number;
  category: 'mineral' | 'location' | 'operation' | 'safety' | 'environment';
  trendPercent: number;
  relatedTerms: string[];
  documentCount: number;
  documentIds: number[];
}

export interface ValidationItem {
  id: string;
  type: 'conflict' | 'low_confidence' | 'missing_data' | 'duplicate';
  severity: 'high' | 'medium' | 'low';
  title: string;
  fieldName: string;
  subsidiary: Subsidiary;
  mineName: string;
  sourceA: {
    documentId: number;
    documentName: string;
    pageNumber: number;
    value: string;
    confidence: number;
  };
  sourceB?: {
    documentId: number;
    documentName: string;
    pageNumber: number;
    value: string;
    confidence: number;
  };
  status: 'pending' | 'resolved' | 'flagged';
  dateReported: string;
  resolutionNote?: string;
}
