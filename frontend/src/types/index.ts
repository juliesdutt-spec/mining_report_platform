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

/**
 * The organisation a document belongs to, read from the report's extracted
 * company name. Not a fixed enum: the corpus decides which organisations
 * exist, so this is whatever value the documents actually carry.
 */
export type Organisation = string;

/** The sidebar's organisation scope — a real organisation, or every one. */
export type OrganisationFilter = Organisation | 'ALL';

export type ValidationStatus = 'validated' | 'needs_review' | 'conflicting' | 'low_confidence';

/**
 * A passage located in a document's own text by evidence_locator, anchoring an
 * extracted value to the page it appears on. Confidence is not modelled by the
 * backend, so it is optional and omitted for real evidence.
 */
export interface EvidenceSnippet {
  id: string;
  documentId: number | string;
  documentName: string;
  pageNumber: number;
  sectionHeader: string;
  field: string;
  extractedValue: string;
  originalContext: string;
  confidence?: number;
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
  organisation?: Organisation;
  validationStatus?: ValidationStatus;
}

export interface QueryResult {
  id: string;
  question: string;
  answer: string;
  /** Provider that answered, or "mock" for a deterministic stand-in. */
  answerSource?: string;
  /** Set when a configured provider was tried and failed — says why. */
  answerNote?: string | null;
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
  /** The organisation of the report the finding was raised against. */
  organisation?: Organisation;
}

export interface ValidationSource {
  documentId: number;
  documentName: string;
  value?: string | null;
}
