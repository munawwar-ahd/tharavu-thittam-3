// App.tsx — Main application component with PDF and Comic support

import { useCallback, useState, useEffect } from 'react';
import './index.css';
import { runOCR, processPDF, getPDFJobStatus, retryPDFPage, generateComic } from './api';
import type { OCRResult, PDFJobStatus, PDFPageResult, ComicGenerateResponse, ComicGenerateRequest } from './api';
import { ScrollBackground, useScrollProgress, useReducedMotion } from './components/ScrollBackground';
import { SectionUpload } from './components/SectionUpload';
import { SectionLanguage } from './components/SectionLanguage';
import { SectionOutput } from './components/SectionOutput';
import { Footer } from './components/Footer';
import { HistorySidebar } from './components/HistorySidebar';
import { LanguageSelector } from './components/LanguageSelector';
import { I18nProvider, useI18n } from './i18n';

// Section heights for scroll progress calculation (in viewport heights)
const SECTION_HEIGHTS = {
  upload: 1.0,     // 100vh
  language: 1.0,   // 100vh
  output: 1.5,     // 150vh
  footer: 0.6,     // 60vh
};

const TOTAL_SCROLL_HEIGHT =
  Object.values(SECTION_HEIGHTS).reduce((a, b) => a + b, 0) * window.innerHeight;

// Polling interval for PDF job status
const PDF_POLL_INTERVAL = 2000;

// Inner App component that uses i18n
function AppInner() {
  const { t } = useI18n();

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Language (OCR language)
  const [lang, setLang] = useState('tam+eng');

  // Image OCR state
  const [processing, setProcessing] = useState(false);
  const [_, setProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [editedText, setEditedText] = useState('');

  // PDF processing state
  const [pdfJob, setPdfJob] = useState<PDFJobStatus | null>(null);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  // Comic generation state
  const [comicResult, setComicResult] = useState<ComicGenerateResponse | null>(null);
  const [comicGenerating, setComicGenerating] = useState(false);
  const [comicProgress, setComicProgress] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [comicScope, setComicScope] = useState<'current_page' | 'selected_pages' | 'entire_document'>('current_page');

  // History sidebar
  const [historyOpen, setHistoryOpen] = useState(false);

  // Scroll background
  const scrollProgress = useScrollProgress(TOTAL_SCROLL_HEIGHT);
  const reducedMotion = useReducedMotion();

  // ─── PDF Job Polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (pdfJob && (pdfJob.status === 'pending' || pdfJob.status === 'processing')) {
      interval = setInterval(async () => {
        try {
          const status = await getPDFJobStatus(pdfJob.job_id);
          setPdfJob(status);
          setPdfProgress(Math.round((status.processed_pages / status.total_pages) * 100));

          if (status.status === 'completed' || status.status === 'failed') {
            setPdfProcessing(false);
            if (interval) clearInterval(interval);
          }
        } catch (e) {
          console.error('PDF status poll failed:', e);
        }
      }, PDF_POLL_INTERVAL);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pdfJob?.job_id, pdfJob?.status]);

  // ─── File handling ───────────────────────────────────────────────────────────
  const handleFileSelect = useCallback((f: File) => {
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png',
      'image/tiff', 'image/tif', 'image/bmp',
      'image/x-tiff', 'image/x-bmp',
      'application/pdf',
    ];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.pdf'];
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(f.type) && !allowedExts.includes(ext)) {
      setUploadError(t('upload.error_unsupported'));
      return;
    }

    const isPDF = f.type === 'application/pdf' || ext === '.pdf';
    const maxSize = isPDF ? 50 * 1024 * 1024 : 20 * 1024 * 1024;

    if (f.size > maxSize) {
      setUploadError(t('upload.error_large'));
      return;
    }

    setUploadError(null);
    setFile(f);
    setResult(null);
    setPdfJob(null);
    setComicResult(null);
    setSelectedPages(new Set());
    setEditedText('');

    const url = URL.createObjectURL(f);
    setPreview(url);
  }, [t]);

  const handleRemoveFile = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setPdfJob(null);
    setComicResult(null);
    setSelectedPages(new Set());
    setEditedText('');
    setUploadError(null);
    setPdfProgress(0);
    setComicProgress(0);
  }, [preview]);

  // ─── Run Image OCR ───────────────────────────────────────────────────────────
  const runOcr = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setResult(null);
    setEditedText('');
    setComicResult(null);

    try {
      const res = await runOCR(file, lang, (p) => setProgress(p));
      setResult(res);
      setEditedText(res.cleaned_text || res.raw_text);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({
        success: false,
        raw_text: '',
        cleaned_text: '',
        tamil_text: '',
        english_translation: null,
        hindi_translation: null,
        suggested_corrections: null,
        confidence_score: null,
        words_with_confidence: [],
        regions_found: 0,
        engine: 'gemini',
        engine_model: '',
        api_key_configured: false,
        language: lang,
        error: `${t('common.error')}: ${msg}. ${t('upload.error_unsupported')}`,
        error_category: 'NETWORK_ERROR',
        quota_exhausted: false,
        model_switched: false,
        final_model: null,
      });
    } finally {
      setProcessing(false);
      setProgress(100);
    }
  }, [file, lang, t]);

  // ─── Process PDF ─────────────────────────────────────────────────────────────
  const processPdfFile = useCallback(async () => {
    if (!file) return;
    setPdfProcessing(true);
    setPdfProgress(0);
    setPdfJob(null);
    setResult(null);
    setComicResult(null);
    setSelectedPages(new Set());
    setEditedText('');

    try {
      const res = await processPDF(file, lang);
      setPdfJob(res);
      setPdfProcessing(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPdfJob({
        job_id: '',
        filename: file.name,
        total_pages: 0,
        processed_pages: 0,
        status: 'failed',
        pages: [],
        error: `${t('common.error')}: ${msg}`,
      });
      setPdfProcessing(false);
    }
  }, [file, lang, t]);

  // ─── Retry PDF Page ──────────────────────────────────────────────────────────
  const handleRetryPDFPage = useCallback(async (pageId: string) => {
    try {
      const updatedPage = await retryPDFPage(pageId, lang);
      setPdfJob(prev => prev ? {
        ...prev,
        pages: prev.pages.map(p => p.page_id === pageId ? updatedPage : p),
      } : null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Retry failed:', msg);
    }
  }, [lang]);

  // ─── Generate Comic ──────────────────────────────────────────────────────────
  const handleGenerateComic = useCallback(async (page: PDFPageResult, allPages: PDFPageResult[]) => {
    if (!file) return;

    setComicGenerating(true);
    setComicProgress(0);
    setComicResult(null);

    let sourceText = '';
    let pageNumbers: number[] = [];
    let scope = comicScope;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      // PDF source
      if (comicScope === 'current_page') {
        sourceText = page.text;
        pageNumbers = [page.page_number];
      } else if (comicScope === 'selected_pages') {
        const selected = allPages.filter(p => selectedPages.has(p.page_number));
        sourceText = selected.map(p => p.text).join('\n\n');
        pageNumbers = selected.map(p => p.page_number).sort((a, b) => a - b);
      } else {
        // entire_document
        sourceText = allPages.map(p => p.text).join('\n\n');
        pageNumbers = allPages.map(p => p.page_number).sort((a, b) => a - b);
      }
    } else {
      // Image source
      sourceText = page.text;
      pageNumbers = [1];
      scope = 'current_page';
    }

    if (!sourceText.trim()) {
      setComicGenerating(false);
      return;
    }

    const request: ComicGenerateRequest = {
      source_type: file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
      text: sourceText,
      language: lang,
      scope,
      document_id: pdfJob?.job_id,
      page_numbers: pageNumbers,
    };

    try {
      const res = await generateComic(request, (p) => setComicProgress(p));
      setComicResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setComicResult({
        success: false,
        image_url: null,
        image_base64: null,
        storyboard: null,
        source_pages: pageNumbers,
        error: `${t('common.error')}: ${msg}`,
      });
    } finally {
      setComicGenerating(false);
      setComicProgress(100);
    }
  }, [file, lang, comicScope, selectedPages, pdfJob, t]);

  // ─── Download Comic ──────────────────────────────────────────────────────────
  const handleDownloadComic = useCallback(() => {
    if (comicResult?.image_base64) {
      const a = document.createElement('a');
      a.href = comicResult.image_base64;
      a.download = `comic_${Date.now()}.png`;
      a.click();
    }
  }, [comicResult]);

  // ─── Regenerate Comic ────────────────────────────────────────────────────────
  const handleRegenerateComic = useCallback(() => {
    if (pdfJob) {
      // For PDF, regenerate with current scope
      const currentPage = pdfJob.pages.find(p => selectedPages.has(p.page_number)) || pdfJob.pages[0];
      handleGenerateComic(currentPage, pdfJob.pages);
    } else if (result) {
      // For image
      handleGenerateComic(
        { page_number: 1, page_id: 'image_1', text: result.cleaned_text || result.raw_text, status: 'success', ocr_engine: result.engine, ocr_model: result.engine_model, error: null },
        []
      );
    }
  }, [pdfJob, result, selectedPages, handleGenerateComic]);

  // ─── Copy handlers ───────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editedText);
  }, [editedText]);

  // ─── History restore handler ─────────────────────────────────────────────────
  const handleRestoreEntry = useCallback((entry: {
    id: string;
    type: 'query' | 'activity' | 'data';
    title: string;
    subtitle?: string;
    timestamp: number;
    status: 'completed' | 'failed' | 'pending';
    activityType: 'ocr' | 'translation' | 'upload';
    ocrResult?: {
      raw_text: string;
      cleaned_text: string;
      tamil_text: string;
      english_translation: string | null;
      hindi_translation: string | null;
      language: string;
      engine_model: string;
      confidence_score: number | null;
    };
    fileName?: string;
    fileSize?: number;
  }) => {
    if (entry.ocrResult) {
      // Convert the stored partial result back to full OCRResult
      const restoredResult: OCRResult = {
        success: true,
        raw_text: entry.ocrResult.raw_text,
        cleaned_text: entry.ocrResult.cleaned_text,
        tamil_text: entry.ocrResult.tamil_text,
        english_translation: entry.ocrResult.english_translation,
        hindi_translation: entry.ocrResult.hindi_translation,
        suggested_corrections: null,
        confidence_score: entry.ocrResult.confidence_score,
        words_with_confidence: [],
        regions_found: 1,
        engine: 'gemini',
        engine_model: entry.ocrResult.engine_model,
        api_key_configured: true,
        language: entry.ocrResult.language,
        error: null,
        error_category: null,
        quota_exhausted: false,
        model_switched: false,
        final_model: entry.ocrResult.engine_model,
      };
      setResult(restoredResult);
      setEditedText(entry.ocrResult.cleaned_text || entry.ocrResult.raw_text);
      setFile(null);
      setPreview(null);
      setPdfJob(null);
      setComicResult(null);
    }
  }, []);

  const handleNewQuery = useCallback(() => {
    handleRemoveFile();
  }, [handleRemoveFile]);

  // ─── Page selection handlers ─────────────────────────────────────────────────
  const handleTogglePageSelection = useCallback((pageNumber: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNumber)) next.delete(pageNumber);
      else next.add(pageNumber);
      return next;
    });
  }, []);

  const handleComicScopeChange = useCallback((scope: 'current_page' | 'selected_pages' | 'entire_document') => {
    setComicScope(scope);
  }, []);

  // ─── Determine if we should auto-process PDF ────────────────────────────────
  const isPDF = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');

  // Auto-start PDF processing when PDF is selected
  useEffect(() => {
    if (isPDF && file && !pdfJob && !pdfProcessing) {
      processPdfFile();
    }
  }, [isPDF, file, pdfJob, pdfProcessing, processPdfFile]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Scroll-driven animated background — z-index 0, behind everything */}
      <ScrollBackground progress={scrollProgress} reducedMotion={reducedMotion} />

      {/* Language Selector — top-left */}
      <div className="lang-selector-container" role="region" aria-label={t('lang.selector_label')}>
        <LanguageSelector variant="dropdown" />
      </div>

      {/* History toggle button — top-right */}
      <button
        className={`history-toggle ${historyOpen ? 'open' : ''}`}
        onClick={() => setHistoryOpen(!historyOpen)}
        aria-label={historyOpen ? t('history.close') : t('history.open')}
        aria-expanded={historyOpen}
        aria-controls="history-sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="4 17 10 11 4 5" />
          <line x1="10" y1="11" x2="20" y2="11" />
          <polyline points="14 17 20 11 14 5" />
        </svg>
      </button>

      {/* Main scrollable content — z-index 10, above background */}
      <main className="main-content">
        {/* Section 1: Upload */}
        <SectionUpload
          file={file}
          preview={preview}
          onFileSelect={handleFileSelect}
          onRemoveFile={handleRemoveFile}
          error={uploadError}
          isProcessing={processing || pdfProcessing}
        />

        {/* Section 2: Language Selection */}
        <SectionLanguage
          preview={preview}
          fileName={file?.name ?? null}
          language={lang}
          onLanguageChange={setLang}
          processing={processing || pdfProcessing}
          onRunOcr={isPDF ? processPdfFile : runOcr}
        />

        {/* Section 3: Output */}
        <SectionOutput
          result={result}
          pdfJob={pdfJob}
          processing={processing}
          pdfProcessing={pdfProcessing}
          pdfProgress={pdfProgress}
          file={file}
          editedText={editedText}
          onTextChange={setEditedText}
          onCopy={handleCopy}
          onRetryPDFPage={handleRetryPDFPage}
          onGenerateComic={handleGenerateComic}
          comicResult={comicResult}
          comicGenerating={comicGenerating}
          comicProgress={comicProgress}
          selectedPages={selectedPages}
          onTogglePageSelection={handleTogglePageSelection}
          comicScope={comicScope}
          onComicScopeChange={handleComicScopeChange}
          onDownloadComic={handleDownloadComic}
          onRegenerateComic={handleRegenerateComic}
        />

        {/* Section 4: Footer & Team */}
        <Footer />
      </main>

      {/* History Sidebar */}
      <HistorySidebar
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestoreEntry={handleRestoreEntry}
        onNewQuery={handleNewQuery}
        currentResult={result}
        currentFile={file}
        currentLang={lang}
      />
    </>
  );
}

// ─── Main App with I18n Provider ──────────────────────────────────────────────
export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}