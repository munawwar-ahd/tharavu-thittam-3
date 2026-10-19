// API client for தரவு திட்டம் backend — Extended with PDF and Comic support

const configuredApiBase = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
export const API_BASE = import.meta.env.DEV
  ? '/api'
  : configuredApiBase || 'http://localhost:8001';

// Timeout for OCR requests — Gemini can take a few seconds on large images
const OCR_TIMEOUT_MS = 120_000;
// Longer timeout for PDF processing
const PDF_TIMEOUT_MS = 300_000;
// Timeout for comic generation
const COMIC_TIMEOUT_MS = 180_000;

export interface WordConfidence {
  word: string;
  confidence: number;
}

// Extended OCRResult to match new backend's response schema
export interface OCRResult {
  success: boolean;
  raw_text: string;
  cleaned_text: string;
  tamil_text: string;
  english_translation: string | null;
  hindi_translation: string | null;
  suggested_corrections: string | null;
  confidence_score: number | null;
  words_with_confidence: WordConfidence[];
  regions_found: number;
  engine: string;
  engine_model: string;
  api_key_configured: boolean;
  language: string;
  error: string | null;
  error_category: string | null;
  quota_exhausted: boolean;
  model_switched: boolean;
  final_model: string | null;
}

export interface SystemStatus {
  ocr_engine: string;
  ocr_engine_loaded: boolean;
  api_key_configured: boolean;
  gemini_model: string;
  gemini_model_queue: string[];
  pdf_support: boolean;
  ready: boolean;
  diagnostic_message: string | null;
}

// ── PDF Types ──────────────────────────────────────────────────────────────
export interface PDFPageResult {
  page_number: number;
  page_id: string;
  text: string;
  status: 'success' | 'failed' | 'empty' | 'processing';
  error: string | null;
  ocr_engine: string | null;
  ocr_model: string | null;
}

export interface PDFProcessResponse {
  job_id: string;
  filename: string;
  total_pages: number;
  processed_pages: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pages: PDFPageResult[];
  error: string | null;
}

export interface PDFJobStatus {
  job_id: string;
  filename: string;
  total_pages: number;
  processed_pages: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pages: PDFPageResult[];
  error: string | null;
}

// ── Comic Types ────────────────────────────────────────────────────────────
export interface ComicGenerateRequest {
  source_type: 'image' | 'pdf';
  text: string;
  language: string;
  scope: 'current_page' | 'selected_pages' | 'entire_document';
  document_id?: string;
  page_ids?: string[];
  page_numbers?: number[];
}

export interface ComicPanel {
  panel_number: number;
  scene_description: string;
  characters: string[];
  setting: string;
  dialogue: string;
  visual_notes: string;
}

export interface ComicStoryboard {
  panels: ComicPanel[];
  source_pages: number[] | null;
  language: string;
  disclaimer: string;
}

export interface ComicGenerateResponse {
  success: boolean;
  image_url: string | null;
  image_base64: string | null;
  storyboard: ComicStoryboard | null;
  source_pages: number[] | null;
  error: string | null;
}

export class ApiHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

export class ApiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

function isSystemStatus(value: unknown): value is SystemStatus {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'ocr_engine' in value &&
    typeof value.ocr_engine === 'string' &&
    'ocr_engine_loaded' in value &&
    typeof value.ocr_engine_loaded === 'boolean' &&
    'api_key_configured' in value &&
    typeof value.api_key_configured === 'boolean' &&
    'gemini_model' in value &&
    typeof value.gemini_model === 'string' &&
    'ready' in value &&
    typeof value.ready === 'boolean'
  );
}

export async function fetchStatus(): Promise<SystemStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API_BASE}/status`, { signal: controller.signal });
    if (!res.ok) throw new ApiHttpError(res.status);
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new ApiResponseError('Status endpoint did not return valid JSON');
    }
    if (!isSystemStatus(data)) {
      throw new ApiResponseError('Status response does not match the expected API schema');
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function runOCR(
  file: File,
  lang: string,
  onProgress?: (pct: number) => void,
): Promise<OCRResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('lang', lang);
  // New backend expects enhance parameter
  form.append('enhance', 'true');

  // Simulated progress — Gemini has no streaming progress callback
  let tick = 0;
  const interval = onProgress
    ? setInterval(() => {
        tick = Math.min(tick + 3, 88);
        onProgress(tick);
      }, 500)
    : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/ocr`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail: string;
      try {
        const body = await res.json();
        detail = body?.detail ?? `Server error ${res.status}`;
      } catch {
        detail = `Server error ${res.status}`;
      }
      throw new Error(detail);
    }

    const data: OCRResult = await res.json();
    onProgress?.(100);
    return data;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `OCR request timed out after ${OCR_TIMEOUT_MS / 1000}s. Try a smaller image.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (interval) clearInterval(interval);
  }
}

// ── PDF API Functions ──────────────────────────────────────────────────────

export async function processPDF(
  file: File,
  lang: string,
  _onProgress?: (pct: number) => void,
): Promise<PDFProcessResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('lang', lang);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/pdf/process`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail: string;
      try {
        const body = await res.json();
        detail = body?.detail ?? `Server error ${res.status}`;
      } catch {
        detail = `Server error ${res.status}`;
      }
      throw new Error(detail);
    }

    const data: PDFProcessResponse = await res.json();
    return data;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `PDF upload timed out after ${PDF_TIMEOUT_MS / 1000}s.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function getPDFJobStatus(jobId: string): Promise<PDFJobStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${API_BASE}/pdf/jobs/${jobId}`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail: string;
      try {
        const body = await res.json();
        detail = body?.detail ?? `Server error ${res.status}`;
      } catch {
        detail = `Server error ${res.status}`;
      }
      throw new Error(detail);
    }

    const data: PDFJobStatus = await res.json();
    return data;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('PDF status request timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function retryPDFPage(pageId: string, lang: string): Promise<PDFPageResult> {
  const form = new FormData();
  form.append('lang', lang);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/pdf/pages/${pageId}/retry`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail: string;
      try {
        const body = await res.json();
        detail = body?.detail ?? `Server error ${res.status}`;
      } catch {
        detail = `Server error ${res.status}`;
      }
      throw new Error(detail);
    }

    const data: PDFPageResult = await res.json();
    return data;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Retry request timed out after ${OCR_TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Comic API Functions ────────────────────────────────────────────────────

export async function generateComic(
  request: ComicGenerateRequest,
  onProgress?: (pct: number) => void,
): Promise<ComicGenerateResponse> {
  // Simulated progress
  let tick = 0;
  const interval = onProgress
    ? setInterval(() => {
        tick = Math.min(tick + 5, 85);
        onProgress(tick);
      }, 800)
    : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMIC_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/comic/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail: string;
      try {
        const body = await res.json();
        detail = body?.detail ?? `Server error ${res.status}`;
      } catch {
        detail = `Server error ${res.status}`;
      }
      throw new Error(detail);
    }

    const data: ComicGenerateResponse = await res.json();
    onProgress?.(100);
    return data;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `Comic generation timed out after ${COMIC_TIMEOUT_MS / 1000}s.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (interval) clearInterval(interval);
  }
}