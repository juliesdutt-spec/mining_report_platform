import { MiningDocument } from '../types';
import {
  apiFetch,
  BackendExtractedData,
  BackendReportDetail,
  BackendReportListItem,
  BackendReportListResponse,
  BackendUploadResponse,
} from './api';

/** Backend statuses are a superset of the UI's; anything unknown reads as pending. */
function mapStatus(status: string): MiningDocument['status'] {
  switch (status) {
    case 'processing':
    case 'completed':
    case 'error':
      return status;
    default:
      return 'pending';
  }
}

function fileTypeOf(filename: string): MiningDocument['fileType'] {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'docx') return 'DOCX';
  if (ext === 'xlsx') return 'XLSX';
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'IMAGE';
  return 'PDF';
}

/** Drop nulls/empty strings so the UI can distinguish "absent" from "".  */
function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Map a backend report onto the UI document model.
 *
 * Only fields the backend actually returns are populated. Page count,
 * extraction confidence, CIL subsidiary, validation state and per-snippet
 * evidence are not modelled server-side, so they are deliberately left
 * undefined rather than invented — the UI shows an em dash for them.
 */
export function mapReportToDocument(
  report: BackendReportListItem | BackendReportDetail
): MiningDocument {
  const detail = report as Partial<BackendReportDetail>;
  const extracted: BackendExtractedData = detail.extracted_data ?? {};

  return {
    id: report.id,
    filename: report.filename,
    fileType: fileTypeOf(report.filename),
    status: mapStatus(report.status),
    uploadDate: report.upload_date ?? undefined,

    mineName: clean(detail.mine_name) ?? clean(extracted.mine_name),
    location: clean(report.location) ?? clean(extracted.location),
    district: clean(extracted.district),
    state: clean(extracted.state),
    mineralType: clean(report.mineral_type) ?? clean(extracted.mineral_type),
    quantityExtracted: clean(report.quantity_extracted) ?? clean(extracted.quantity_extracted),
    extractionMethod: clean(detail.extraction_method) ?? clean(extracted.extraction_method),
    reserveEstimate: clean(extracted.reserve_estimate),

    topics: report.topics ?? extracted.topics ?? [],
    summary: clean(report.summary) ?? clean(extracted.summary) ?? '',
    keyFindings: extracted.key_findings ?? undefined,

    // The backend produces no per-passage evidence for uploaded documents.
    evidenceSnippets: [],
  };
}

/** GET /reports — real documents only; throws so the UI can show the error. */
export async function fetchDocuments(): Promise<MiningDocument[]> {
  const data = await apiFetch<BackendReportListResponse>('/reports?limit=100');
  return (data.reports ?? []).map(mapReportToDocument);
}

/** GET /reports/{id} — full detail, including AI-extracted fields. */
export async function getDocumentById(id: number): Promise<MiningDocument | undefined> {
  try {
    const detail = await apiFetch<BackendReportDetail>(`/reports/${id}`);
    return mapReportToDocument(detail);
  } catch {
    return undefined;
  }
}

/**
 * POST /upload — multipart form with a single `file` field. The backend only
 * accepts PDFs and runs text extraction plus AI extraction synchronously, so
 * this can take a while; hence the long timeout.
 */
export async function uploadMiningDocument(file: File): Promise<MiningDocument> {
  const form = new FormData();
  form.append('file', file);

  const res = await apiFetch<BackendUploadResponse>(
    '/upload',
    { method: 'POST', body: form },
    180000
  );

  return mapReportToDocument({
    id: res.id,
    filename: res.filename,
    status: res.status,
    upload_date: new Date().toISOString(),
    extracted_data: res.extracted_data,
    mineral_type: res.extracted_data?.mineral_type ?? null,
    location: res.extracted_data?.location ?? null,
    quantity_extracted: res.extracted_data?.quantity_extracted ?? null,
    summary: res.extracted_data?.summary ?? null,
    topics: res.extracted_data?.topics ?? null,
    report_date: res.extracted_data?.report_date ?? null,
    extraction_method: res.extracted_data?.extraction_method ?? null,
    company_name: res.extracted_data?.company_name ?? null,
    mine_name: res.extracted_data?.mine_name ?? null,
    word_cloud_available: res.word_cloud_available,
    error_message: null,
  });
}
