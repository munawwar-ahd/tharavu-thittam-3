// PDFPageResults.tsx — Display PDF processing results page by page

import { useCallback, useState } from 'react';
import { useI18n } from '../i18n';
import type { PDFPageResult } from '../api';

interface PDFPageResultsProps {
  pages: PDFPageResult[];
  filename: string;
  totalPages: number;
  processedPages: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  onRetryPage: (pageId: string) => Promise<void>;
  onCopyPage: (text: string, pageNumber: number) => void;
  onCopyAll: (pages: PDFPageResult[]) => void;
  onGenerateComic: (page: PDFPageResult, allPages: PDFPageResult[]) => void;
  selectedPages: Set<number>;
  onTogglePageSelection: (pageNumber: number) => void;
  comicScope: 'current_page' | 'selected_pages' | 'entire_document';
  onComicScopeChange: (scope: 'current_page' | 'selected_pages' | 'entire_document') => void;
  isGeneratingComic: boolean;
  comicProgress: number;
}

function getStatusColor(status: PDFPageResult['status']): string {
  switch (status) {
    case 'success': return 'var(--c-success)';
    case 'failed': return 'var(--c-danger)';
    case 'empty': return 'var(--c-warn)';
    case 'processing': return 'var(--c-text-2)';
    default: return 'var(--c-text-3)';
  }
}

function getStatusLabel(status: PDFPageResult['status'], t: (key: string) => string): string {
  switch (status) {
    case 'success': return t('pdf.page_status_success');
    case 'failed': return t('pdf.page_status_failed');
    case 'empty': return t('pdf.page_status_empty');
    case 'processing': return t('pdf.page_status_processing');
    default: return status;
  }
}

export function PDFPageResults({
  pages,
  filename,
  totalPages,
  processedPages,
  status,
  onRetryPage,
  onCopyPage,
  onCopyAll,
  onGenerateComic,
  selectedPages,
  onTogglePageSelection,
  comicScope,
  onComicScopeChange,
  isGeneratingComic,
  comicProgress,
}: PDFPageResultsProps) {
  const { t } = useI18n();
  const [copiedPage, setCopiedPage] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());

  const handleCopyPage = useCallback((page: PDFPageResult) => {
    if (page.text.trim()) {
      onCopyPage(page.text, page.page_number);
      setCopiedPage(page.page_number);
      setTimeout(() => setCopiedPage(null), 2000);
    }
  }, [onCopyPage]);

  const handleCopyAll = useCallback(() => {
    onCopyAll(pages);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [onCopyAll, pages]);

  const handleRetry = useCallback(async (page: PDFPageResult) => {
    await onRetryPage(page.page_id);
  }, [onRetryPage]);

  const handleGenerateComic = useCallback((page: PDFPageResult) => {
    onGenerateComic(page, pages);
  }, [onGenerateComic, pages]);

  const toggleExpanded = useCallback((pageNumber: number) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNumber)) next.delete(pageNumber);
      else next.add(pageNumber);
      return next;
    });
  }, []);

  if (pages.length === 0 && status !== 'processing') {
    return (
      <div className="pdf-results-empty">
        <p>{t('pdf.no_text')}</p>
      </div>
    );
  }

  return (
    <div className="pdf-results">
      {/* Document Summary */}
      <div className="pdf-summary panel">
        <div className="pdf-summary-header">
          <h3 className="pdf-summary-title">{t('pdf.title')}</h3>
          <span className={`pdf-status-badge status-${status}`}>
            {status === 'pending' && t('pdf.status_pending')}
            {status === 'processing' && `${t('pdf.status_processing')} (${processedPages}/${totalPages})`}
            {status === 'completed' && t('pdf.status_completed')}
            {status === 'failed' && t('pdf.status_failed')}
          </span>
        </div>
        <div className="pdf-summary-meta">
          <span>{t('pdf.filename', { name: filename })}</span>
          <span>{t('pdf.total_pages', { count: String(totalPages) })}</span>
          <span>{t('pdf.processed_pages', { count: String(processedPages) })}</span>
        </div>
        <div className="pdf-summary-actions">
          <button className="btn-secondary" onClick={handleCopyAll} disabled={pages.every(p => !p.text.trim())}>
            {copiedAll ? t('pdf.copied_all') : t('pdf.copy_all')}
          </button>
        </div>
      </div>

      {/* Page Results */}
      <div className="pdf-pages" role="list" aria-label={t('pdf.title')}>
        {pages.map((page) => (
          <article
            key={page.page_id}
            className={`pdf-page panel ${expandedPages.has(page.page_number) ? 'expanded' : ''}`}
            role="listitem"
            aria-label={t('pdf.page_label', { num: String(page.page_number), total: String(totalPages) })}
          >
            {/* Page Header */}
            <header className="pdf-page-header">
              <div className="pdf-page-title-row">
                <h4 className="pdf-page-number">
                  {t('pdf.page_label', { num: String(page.page_number), total: String(totalPages) })}
                </h4>
                <span
                  className="pdf-page-status"
                  style={{ color: getStatusColor(page.status) }}
                >
                  {getStatusLabel(page.status, t)}
                </span>
              </div>
              <div className="pdf-page-meta">
                {page.ocr_engine && (
                  <span className="pdf-page-engine">
                    {page.ocr_engine === 'pdf_text'
                      ? t('pdf.pdf_text')
                      : t('pdf.ocr_engine', { engine: page.ocr_engine })}
                  </span>
                )}
                {page.ocr_model && (
                  <span className="pdf-page-model">{page.ocr_model}</span>
                )}
              </div>
            </header>

            {/* Page Content */}
            <div className="pdf-page-content">
              {page.status === 'processing' ? (
                <div className="pdf-page-processing">
                  <div className="spinner" aria-hidden="true" />
                  <span>{t('pdf.page_status_processing')}</span>
                </div>
              ) : page.status === 'failed' ? (
                <div className="pdf-page-error">
                  <p>{page.error || t('common.error')}</p>
                  <button
                    className="btn-secondary btn-retry"
                    onClick={() => handleRetry(page)}
                    disabled={isGeneratingComic}
                  >
                    {t('pdf.retry_page')}
                  </button>
                </div>
              ) : page.text.trim() ? (
                <>
                  <div className="pdf-page-text" aria-label={`Page ${page.page_number} text`}>
                    <pre>{page.text}</pre>
                  </div>
                  <footer className="pdf-page-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => handleCopyPage(page)}
                      disabled={!page.text.trim()}
                    >
                      {copiedPage === page.page_number ? t('pdf.copied_page') : t('pdf.copy_page')}
                    </button>
                    <label className="pdf-page-select">
                      <input
                        type="checkbox"
                        checked={selectedPages.has(page.page_number)}
                        onChange={() => onTogglePageSelection(page.page_number)}
                        disabled={isGeneratingComic}
                      />
                      <span>{t('comic.scope_selected')}</span>
                    </label>
                    <button
                      className="btn-secondary btn-comic"
                      onClick={() => handleGenerateComic(page)}
                      disabled={isGeneratingComic || !page.text.trim()}
                    >
                      {t('comic.generate_btn')}
                    </button>
                  </footer>
                </>
              ) : (
                <div className="pdf-page-empty">
                  <p>{t('pdf.no_text')}</p>
                  <button
                    className="btn-secondary btn-retry"
                    onClick={() => handleRetry(page)}
                    disabled={isGeneratingComic}
                  >
                    {t('pdf.retry_page')}
                  </button>
                </div>
              )}
            </div>

            {/* Expand/Collapse Toggle */}
            <button
              className="pdf-page-toggle"
              onClick={() => toggleExpanded(page.page_number)}
              aria-expanded={expandedPages.has(page.page_number)}
              aria-controls={`page-${page.page_number}-content`}
            >
              {expandedPages.has(page.page_number) ? '▲' : '▼'} {t('output.meta_lang', { lang: 'Details' })}
            </button>
          </article>
        ))}
      </div>

      {/* Comic Generation Controls */}
      {pages.some(p => p.text.trim()) && (
        <div className="comic-generation-section panel">
          <h4>{t('comic.title')}</h4>
          
          <div className="comic-scope-selector">
            <label>{t('comic.scope_label')}</label>
            <div className="comic-scope-options" role="radiogroup" aria-label={t('comic.scope_label')}>
              <label className={`radio-option ${comicScope === 'current_page' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="comic-scope"
                  value="current_page"
                  checked={comicScope === 'current_page'}
                  onChange={() => onComicScopeChange('current_page')}
                  disabled={isGeneratingComic}
                />
                <span className="radio-custom" aria-hidden="true"><span className="radio-dot" /></span>
                <span className="radio-label">{t('comic.scope_current')}</span>
              </label>
              <label className={`radio-option ${comicScope === 'selected_pages' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="comic-scope"
                  value="selected_pages"
                  checked={comicScope === 'selected_pages'}
                  onChange={() => onComicScopeChange('selected_pages')}
                  disabled={isGeneratingComic || selectedPages.size === 0}
                />
                <span className="radio-custom" aria-hidden="true"><span className="radio-dot" /></span>
                <span className="radio-label">{t('comic.scope_selected')} ({selectedPages.size})</span>
              </label>
              <label className={`radio-option ${comicScope === 'entire_document' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="comic-scope"
                  value="entire_document"
                  checked={comicScope === 'entire_document'}
                  onChange={() => onComicScopeChange('entire_document')}
                  disabled={isGeneratingComic}
                />
                <span className="radio-custom" aria-hidden="true"><span className="radio-dot" /></span>
                <span className="radio-label">{t('comic.scope_all')}</span>
              </label>
            </div>
          </div>

          <div className="comic-generate-actions">
            <button
              className="btn-primary btn-generate-comic"
              onClick={() => {
                const currentPage = pages.find(p => expandedPages.has(p.page_number)) || pages[0];
                handleGenerateComic(currentPage);
              }}
              disabled={isGeneratingComic || pages.every(p => !p.text.trim())}
            >
              {isGeneratingComic ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  {t('comic.generating')} {comicProgress > 0 && `(${comicProgress}%)`}
                </>
              ) : (
                t('comic.generate_btn')
              )}
            </button>
          </div>

          <p className="comic-disclaimer">{t('comic.ai_disclaimer')}</p>
        </div>
      )}
    </div>
  );
}