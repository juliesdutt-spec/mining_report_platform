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

/**
 * A document in the DataForge index.
 *
 * Fields the FastAPI backend genuinely supplies are required; everything the
 * backend has no concept of (page counts, extraction confidence, CIL
 * subsidiary, validation state, per-snippet evidence) is optional and is left
 * undefined for real documents rather than filled with invented values. The UI
 * renders an em dash for those instead of a fabricated figure.
 */
export interface MiningDocument {
  id: number;
  filename: string;
  fileType: 'PDF' | 'DOCX' | 'XLSX' | 'IMAGE';
  status: 'processing' | 'completed' | 'error' | 'pending';
  topics: string[];
  summary: string;
  evidenceSnippets: EvidenceSnippet[];

  /** Supplied by the backend when extraction found them. */
  uploadDate?: string;
  mineName?: string;
  location?: string;
  district?: string;
  state?: string;
  mineralType?: string;
  quantityExtracted?: string;
  extractionMethod?: string;
  reserveEstimate?: string;
  keyFindings?: string[];
  rawText?: string;

  /** Not modelled by the backend — undefined for real documents. */
  fileSizeBytes?: number;
  pageCount?: number;
  confidenceScore?: number;
  subsidiary?: Subsidiary;
  validationStatus?: ValidationStatus;
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
    /** Not returned by POST /query — undefined for real answers. */
    pageNumbers?: number[];
    relevanceScore?: number;
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

/**
 * A discrepancy computed by the backend from the stored reports
 * (validation_engine.detect_discrepancies).
 *
 * Page numbers and per-extraction confidence are not modelled server-side, so
 * they are absent here rather than invented; the UI omits them.
 */
export interface ValidationItem {
  id: string;
  type: 'conflict' | 'duplicate' | 'missing_data' | 'extraction_error';
  severity: 'high' | 'medium' | 'low';
  title: string;
  fieldName: string;
  /** Present when the reports identify a mine or location. */
  mineName?: string;
  /** Explains why the finding was raised. */
  detail?: string;
  sourceA: ValidationSource;
  sourceB?: ValidationSource | null;
  status: 'pending' | 'resolved' | 'flagged';
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  /** Not modelled by the backend. */
  subsidiary?: Subsidiary;
}

export interface ValidationSource {
  documentId: number;
  documentName: string;
  value?: string | null;
}
