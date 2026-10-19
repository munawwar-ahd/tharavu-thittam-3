// i18n.ts — Centralized internationalization system for TamilVault AI

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type Locale = 'en' | 'ta' | 'hi';

interface TranslationDict {
  [key: string]: string;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

// English translations (base)
const en: TranslationDict = {
  'app.title': 'Tharavu Thittam - DATA PLAN',
  'app.subtitle': 'TamilVault AI — Historical Tamil OCR & Translation',
  'status.backend_offline': 'Backend offline',
  'status.api_error': 'API error {{status}}',
  'status.unexpected_response': 'Unexpected response',
  'status.connecting': 'Connecting…',
  'status.ready': 'Ready — {{model}}',
  'status.engine_unavailable': 'Engine unavailable',
  'status.api_key_not_set': 'API key not set',
  'status.ocr_not_ready': 'OCR not ready',
  'upload.heading': 'Tharavu Thittam - DATA PLAN',
  'upload.drop_text': 'Drop image or PDF',
  'upload.drop_subtext': 'JPEG · PNG · TIFF · BMP · PDF',
  'upload.drop_subtext_pdf': 'Supports text-based and scanned PDFs',
  'upload.filename': '{{name}}',
  'upload.filesize': '{{size}} KB{{type}}',
  'upload.replace': 'Replace',
  'upload.remove': 'Remove',
  'upload.aria_label_empty': 'Drop zone — drop an image or PDF here or click to browse',
  'upload.aria_label_filled': 'Image selected',
  'upload.aria_label_pdf': 'PDF selected',
  'upload.error_unsupported': 'Unsupported file type. Use JPEG, PNG, TIFF, BMP, or PDF.',
  'upload.error_large': 'File too large. Maximum size is 20 MB for images, 50 MB for PDFs.',
  'language.heading': 'Select language',
  'language.option_tam_eng': 'Tamil + English',
  'language.option_tam': 'Tamil',
  'language.option_eng': 'English',
  'language.option_tam_eng_hin': 'Tamil + English + Hindi',
  'language.option_tam_hin': 'Tamil + Hindi',
  'language.run_ocr': 'Extract Text',
  'language.processing': 'Processing…',
  'output.heading': 'Output',
  'output.progress_aria': 'OCR processing progress',
  'output.error_title': 'Error',
  'output.meta_engine': '{{model}}',
  'output.meta_lang': '{{lang}}',
  'output.copy': 'Copy',
  'output.copied': 'Copied',
  'output.reset': 'Reset',
  'output.placeholder': 'OCR output will appear here…',
  'output.success': 'Transcription complete. You can edit the text above.',
  'output.download_text': 'Download Text',
  'output.download_json': 'Download JSON',
  'output.download_raw': 'Download Raw',
  'output.empty_title': 'No result yet',
  'output.empty_sub': 'Upload an image, select a language, and click <strong>Extract Text</strong> to run OCR.',
  'pdf.title': 'PDF Processing Results',
  'pdf.filename': 'File: {{name}}',
  'pdf.total_pages': 'Total Pages: {{count}}',
  'pdf.processed_pages': 'Processed: {{count}}',
  'pdf.status_pending': 'Pending…',
  'pdf.status_processing': 'Processing…',
  'pdf.status_completed': 'Completed',
  'pdf.status_failed': 'Failed',
  'pdf.page_label': 'Page {{num}} of {{total}}',
  'pdf.page_status_success': 'Success',
  'pdf.page_status_failed': 'Failed',
  'pdf.page_status_empty': 'No text found',
  'pdf.page_status_processing': 'Processing…',
  'pdf.copy_page': 'Copy Page',
  'pdf.copy_all': 'Copy All Pages',
  'pdf.copied_page': 'Page copied!',
  'pdf.copied_all': 'All pages copied!',
  'pdf.retry_page': 'Retry Page',
  'pdf.retrying': 'Retrying…',
  'pdf.no_text': 'No readable text found on this page.',
  'pdf.ocr_engine': 'OCR: {{engine}}',
  'pdf.pdf_text': 'Extracted from PDF text layer',
  'comic.title': 'AI Comic Generation',
  'comic.toggle_label': 'Generate Comic',
  'comic.generate_btn': 'Generate Comic Page',
  'comic.generating': 'Generating comic…',
  'comic.scope_current': 'Current Page',
  'comic.scope_selected': 'Selected Pages',
  'comic.scope_all': 'Entire Document',
  'comic.scope_label': 'Generation Scope',
  'comic.download': 'Download Comic',
  'comic.regenerate': 'Regenerate',
  'comic.source_pages': 'Source: Pages {{pages}}',
  'comic.ai_disclaimer': 'AI-generated interpretation — not a verified historical reconstruction.',
  'comic.error_generation': 'Comic generation failed. Please try again.',
  'comic.storyboard_generating': 'Creating storyboard…',
  'comic.artwork_generating': 'Generating artwork…',
  'footer.designed_by': 'Designed & Developed by',
  'footer.team_name': 'Team Thunderbolts*',
  'footer.team_members': 'Team Members',
  'footer.modal_title': 'Team Members',
  'footer.modal_note': 'Project Tharavu Thittam',
  'footer.close': 'Close',
  'history.title': 'History',
  'history.open': 'Open History',
  'history.close': 'Close History',
  'history.empty': 'No history yet. Your OCR results will appear here.',
  'history.recent_queries': 'Recent Queries',
  'history.recent_activities': 'Recent Activities',
  'history.processed_data': 'Processed Data',
  'history.query_summary': 'Query',
  'history.activity_type': 'Type',
  'history.date_time': 'Date & Time',
  'history.status': 'Status',
  'history.restore': 'Restore',
  'history.delete': 'Delete',
  'history.clear_all': 'Clear All',
  'history.new_query': 'New Query',
  'history.ocr_result': 'OCR Result',
  'history.translation': 'Translation',
  'history.upload': 'Image Upload',
  'history.completed': 'Completed',
  'history.failed': 'Failed',
  'history.pending': 'Pending',
  'lang.selector_label': 'Interface Language',
  'lang.en': 'English',
  'lang.ta': 'Tamil',
  'lang.hi': 'Hindi',
  'common.loading': 'Loading…',
  'common.error': 'Error',
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.confirm': 'Confirm',
  'common.close': 'Close',
};

// Tamil translations (simplified - fallback to English)
const ta: TranslationDict = { ...en, 'lang.ta': 'தமிழ்' };

// Hindi translations (simplified - fallback to English)
const hi: TranslationDict = { ...en, 'lang.hi': 'हिन्दी' };

const locales: Record<Locale, TranslationDict> = { en, ta, hi };
const LOCALE_STORAGE_KEY = 'tamilvault.locale';

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && (saved === 'en' || saved === 'ta' || saved === 'hi')) return saved as Locale;
  } catch {}
  return 'en';
}

function interpolate(str: string, params?: Record<string, string>): string {
  if (!params) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? '');
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale());
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, newLocale); } catch {}
  }, []);
  const t = useCallback((key: string, params?: Record<string, string>): string => {
    const dict = locales[locale] || en;
    const translation = dict[key] || en[key] || key;
    return interpolate(translation, params);
  }, [locale]);
  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}

export { locales, type Locale };