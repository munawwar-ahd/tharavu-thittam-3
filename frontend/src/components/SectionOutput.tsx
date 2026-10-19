// SectionOutput.tsx — OCR/PDF results display with comic generation

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OCRResult } from '../api';
import { useI18n } from '../i18n';
import { PDFPageResults } from './PDFPageResults';
import type { PDFPageResult, PDFJobStatus, ComicGenerateResponse } from '../api';

interface SectionOutputProps {
  result: OCRResult | null;
  pdfJob: PDFJobStatus | null;
  processing: boolean;
  pdfProcessing: boolean;
  pdfProgress: number;
  file: File | null;
  editedText: string;
  onTextChange: (text: string) => void;
  onCopy: () => void;
  onRetryPDFPage: (pageId: string) => Promise<void>;
  onGenerateComic: (page: PDFPageResult, allPages: PDFPageResult[]) => void;
  comicResult: ComicGenerateResponse | null;
  comicGenerating: boolean;
  comicProgress: number;
  selectedPages: Set<number>;
  onTogglePageSelection: (pageNumber: number) => void;
  comicScope: 'current_page' | 'selected_pages' | 'entire_document';
  onComicScopeChange: (scope: 'current_page' | 'selected_pages' | 'entire_document') => void;
  onDownloadComic: () => void;
  onRegenerateComic: () => void;
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function SectionOutput({
  result,
  pdfJob,
  processing,
  pdfProcessing,
  pdfProgress,
  file,
  editedText,
  onTextChange,
  onCopy,
  onRetryPDFPage,
  onGenerateComic,
  comicResult,
  comicGenerating,
  comicProgress,
  selectedPages,
  onTogglePageSelection,
  comicScope,
  onComicScopeChange,
  onDownloadComic,
  onRegenerateComic,
}: SectionOutputProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const isPDF = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');
  const showPDFResults = pdfJob && pdfJob.pages.length > 0;
  const showComicResult = comicResult && comicResult.success;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.max(200, ta.scrollHeight)}px`;
    }
  }, [editedText, result]);

  const handleCopy = useCallback(() => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy]);

  const handleDownloadText = useCallback(() => {
    if (result) {
      downloadText(editedText, 'tamil_ocr_output.txt');
    } else if (pdfJob) {
      const allText = pdfJob.pages.map(p => p.text).join('\n\n--- Page Break ---\n\n');
      downloadText(allText, `${pdfJob.filename.replace('.pdf', '')}_full_text.txt`);
    }
  }, [result, pdfJob, editedText]);

  const handleDownloadJson = useCallback(() => {
    if (result && file) {
      downloadJSON({
        file: file.name,
        language: result.language,
        engine: result.engine,
        engine_model: result.engine_model,
        raw_text: result.raw_text,
        cleaned_text: result.cleaned_text,
        edited_text: editedText,
      }, 'tamil_ocr_result.json');
    } else if (pdfJob) {
      downloadJSON({
        file: pdfJob.filename,
        total_pages: pdfJob.total_pages,
        pages: pdfJob.pages.map(p => ({
          page_number: p.page_number,
          text: p.text,
          status: p.status,
          engine: p.ocr_engine,
          model: p.ocr_model,
        })),
      }, `${pdfJob.filename.replace('.pdf', '')}_result.json`);
    }
  }, [result, file, pdfJob, editedText]);

  const handleDownloadRaw = useCallback(() => {
    if (result) {
      downloadText(result.raw_text, 'raw_ocr_output.txt');
    }
  }, [result]);

  // Determine what to show
  const showImageOCR = result && !isPDF;
  const showPDFView = isPDF && showPDFResults;

  return (
    <section className="section section-output" aria-labelledby="output-heading">
      <div className="section-content">
        <h2 id="output-heading" className="section-title">{t('output.heading')}</h2>

        {/* Progress for Image OCR */}
        {processing && !isPDF && (
          <div
            className="progress-container"
            role="progressbar"
            aria-valuenow={pdfProgress || 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('output.progress_aria')}
          >
            <div className="progress-bar" style={{ width: `${pdfProgress || 0}%` }} />
            <span className="progress-text">{Math.round(pdfProgress || 0)}%</span>
          </div>
        )}

        {/* Progress for PDF Processing */}
        {pdfProcessing && (
          <div
            className="progress-container"
            role="progressbar"
            aria-valuenow={pdfProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('pdf.status_processing')}
          >
            <div className="progress-bar" style={{ width: `${pdfProgress}%` }} />
            <span className="progress-text">
              {t('pdf.status_processing')} ({Math.round(pdfProgress)}%)
            </span>
          </div>
        )}

        {/* Comic Generation Progress */}
        {comicGenerating && (
          <div
            className="progress-container"
            role="progressbar"
            aria-valuenow={comicProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('comic.generating')}
          >
            <div className="progress-bar" style={{ width: `${comicProgress}%` }} />
            <span className="progress-text">
              {t('comic.generating')} ({Math.round(comicProgress)}%)
            </span>
          </div>
        )}

        {/* Error Display */}
        {(result?.error || pdfJob?.error) && (
          <div className="output-error" role="alert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <div className="output-error-content">
              <strong>{t('output.error_title')}</strong>
              <p>{result?.error || pdfJob?.error}</p>
            </div>
          </div>
        )}

        {/* Image OCR Results */}
        {showImageOCR && result?.success && (
          <>
            <div className="output-header">
              <div className="output-meta">
                <span className="output-engine">{t('output.meta_engine', { model: result.engine_model || 'Gemini' })}</span>
                <span className="output-lang">{t('output.meta_lang', { lang: result.language })}</span>
              </div>
              <div className="output-actions">
                <button
                  className="btn-secondary"
                  onClick={handleCopy}
                  aria-label={copied ? t('output.copied') : t('output.copy')}
                >
                  {copied ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {t('output.copied')}
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      {t('output.copy')}
                    </>
                  )}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => onTextChange(result.raw_text)}
                  aria-label={t('output.reset')}
                >
                  {t('output.reset')}
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              className="output-textarea"
              value={editedText}
              onChange={(e) => onTextChange(e.target.value)}
              spellCheck={false}
              placeholder={t('output.placeholder')}
              aria-label={t('output.heading')}
              rows={12}
            />

            <div className="output-success" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{t('output.success')}</span>
            </div>

            <div className="output-export">
              <button className="btn-export" onClick={handleDownloadText}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {t('output.download_text')}
              </button>
              <button className="btn-export" onClick={handleDownloadJson}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                {t('output.download_json')}
              </button>
              <button className="btn-export" onClick={handleDownloadRaw}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {t('output.download_raw')}
              </button>
            </div>

            {/* Comic Generation Toggle for Image */}
            <div className="comic-generation-section panel">
              <h4>{t('comic.title')}</h4>
              <label className="comic-toggle">
                <input
                  type="checkbox"
                  defaultChecked={false}
                  onChange={() => {}}
                />
                <span>{t('comic.toggle_label')}</span>
              </label>
              <p className="comic-hint">
                {t('comic.scope_current')} - {t('comic.generate_btn')} will use the OCR text above.
              </p>
              <button
                className="btn-primary btn-generate-comic"
                onClick={() => onGenerateComic(
                  { page_number: 1, page_id: 'image_1', text: result.cleaned_text || result.raw_text, status: 'success', ocr_engine: result.engine, ocr_model: result.engine_model, error: null },
                  []
                )}
                disabled={comicGenerating || !result.cleaned_text}
              >
                {comicGenerating ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    {t('comic.generating')} {comicProgress > 0 && `(${comicProgress}%)`}
                  </>
                ) : (
                  t('comic.generate_btn')
                )}
              </button>
              <p className="comic-disclaimer">{t('comic.ai_disclaimer')}</p>
            </div>
          </>
        )}

        {/* PDF Results */}
        {showPDFView && pdfJob && (
          <PDFPageResults
            pages={pdfJob.pages}
            filename={pdfJob.filename}
            totalPages={pdfJob.total_pages}
            processedPages={pdfJob.processed_pages}
            status={pdfJob.status}
            onRetryPage={onRetryPDFPage}
            onCopyPage={(text, _pageNum) => {
              navigator.clipboard.writeText(text);
            }}
            onCopyAll={(pages) => {
              const allText = pages.map(p => p.text).join('\n\n--- Page Break ---\n\n');
              navigator.clipboard.writeText(allText);
            }}
            onGenerateComic={onGenerateComic}
            selectedPages={selectedPages}
            onTogglePageSelection={onTogglePageSelection}
            comicScope={comicScope}
            onComicScopeChange={onComicScopeChange}
            isGeneratingComic={comicGenerating}
            comicProgress={comicProgress}
          />
        )}

        {/* Comic Result Display */}
        {showComicResult && comicResult && (
          <div className="comic-result panel">
            <div className="comic-result-header">
              <h3>{t('comic.title')}</h3>
              <div className="comic-result-meta">
                {comicResult.source_pages && (
                  <span>{t('comic.source_pages', { pages: comicResult.source_pages.join(', ') })}</span>
                )}
              </div>
            </div>

            {comicResult.image_base64 && (
              <div className="comic-image-container">
                <img
                  src={comicResult.image_base64}
                  alt="AI-generated comic page"
                  className="comic-image"
                />
              </div>
            )}

            {comicResult.storyboard && (
              <details className="comic-storyboard">
                <summary>{t('comic.storyboard_generating').replace('…', '')}</summary>
                <div className="storyboard-panels">
                  {comicResult.storyboard.panels.map((panel) => (
                    <div key={panel.panel_number} className="storyboard-panel">
                      <h5>Panel {panel.panel_number}</h5>
                      <p><strong>Scene:</strong> {panel.scene_description}</p>
                      <p><strong>Characters:</strong> {panel.characters.join(', ')}</p>
                      <p><strong>Setting:</strong> {panel.setting}</p>
                      <p><strong>Dialogue:</strong> {panel.dialogue}</p>
                      <p><strong>Notes:</strong> {panel.visual_notes}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="comic-result-actions">
              {comicResult.image_base64 && (
                <button className="btn-export" onClick={onDownloadComic}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {t('comic.download')}
                </button>
              )}
              <button className="btn-secondary" onClick={onRegenerateComic} disabled={comicGenerating}>
                {t('comic.regenerate')}
              </button>
            </div>

            <p className="comic-disclaimer">{t('comic.ai_disclaimer')}</p>
            {comicResult.error && (
              <p className="comic-error">{comicResult.error}</p>
            )}
          </div>
        )}

        {/* Empty State */}
        {!result && !pdfJob && !processing && !pdfProcessing && !showComicResult && (
          <div className="output-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="output-empty-title">{t('output.empty_title')}</p>
            <p className="output-empty-sub" dangerouslySetInnerHTML={{ __html: t('output.empty_sub') }} />
          </div>
        )}

        {/* PDF Empty State during processing */}
        {isPDF && !showPDFResults && !pdfProcessing && pdfJob && pdfJob.status === 'pending' && (
          <div className="output-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="output-empty-title">{t('pdf.title')}</p>
            <p className="output-empty-sub">{t('pdf.status_pending')}</p>
          </div>
        )}
      </div>
    </section>
  );
}