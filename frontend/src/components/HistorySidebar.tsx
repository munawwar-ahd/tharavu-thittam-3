// HistorySidebar.tsx — Collapsible history panel with localStorage persistence

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../i18n';

export interface HistoryEntry {
  id: string;
  type: 'query' | 'activity' | 'data';
  title: string;
  subtitle?: string;
  timestamp: number;
  status: 'completed' | 'failed' | 'pending';
  activityType: 'ocr' | 'translation' | 'upload';
  // Stored data for restoration
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
}

const HISTORY_STORAGE_KEY = 'tamilvault.history';
const MAX_HISTORY_ENTRIES = 50;

function loadHistory(): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_HISTORY_ENTRIES);
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore quota errors
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreEntry: (entry: HistoryEntry) => void;
  onNewQuery: () => void;
  currentResult?: {
    success: boolean;
    raw_text: string;
    cleaned_text: string;
    tamil_text: string;
    english_translation: string | null;
    hindi_translation: string | null;
    language: string;
    engine_model: string;
    confidence_score: number | null;
  } | null;
  currentFile?: File | null;
  currentLang?: string;
}

export function HistorySidebar({
  isOpen,
  onClose,
  onRestoreEntry,
  onNewQuery,
  currentResult,
  currentFile,
  currentLang,
}: HistorySidebarProps) {
  const { t } = useI18n();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'queries' | 'activities' | 'data'>('queries');
  const sidebarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Save current result to history when it changes (success only)
  useEffect(() => {
    if (currentResult?.success && currentFile) {
      const newEntry: HistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: 'data',
        title: t('history.ocr_result'),
        subtitle: currentFile.name,
        timestamp: Date.now(),
        status: 'completed',
        activityType: 'ocr',
        ocrResult: {
          raw_text: currentResult.raw_text,
          cleaned_text: currentResult.cleaned_text,
          tamil_text: currentResult.tamil_text,
          english_translation: currentResult.english_translation,
          hindi_translation: currentResult.hindi_translation,
          language: currentResult.language,
          engine_model: currentResult.engine_model,
          confidence_score: currentResult.confidence_score,
        },
        fileName: currentFile.name,
        fileSize: currentFile.size,
      };

      setHistory(prev => {
        const updated = [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
        saveHistory(updated);
        return updated;
      });
    }
  }, [currentResult, currentFile, currentLang, t]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleRestore = useCallback((entry: HistoryEntry) => {
    onRestoreEntry(entry);
    onClose();
  }, [onRestoreEntry, onClose]);

  const handleDelete = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(e => e.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    if (window.confirm(t('common.confirm') + ' — ' + t('history.clear_all') + '?')) {
      setHistory([]);
      saveHistory([]);
    }
  }, [t]);

  const filteredHistory = history.filter(entry => {
    if (activeTab === 'queries') return entry.type === 'query';
    if (activeTab === 'activities') return entry.type === 'activity';
    return entry.type === 'data';
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="history-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className="history-sidebar"
        role="complementary"
        aria-label={t('history.title')}
      >
        {/* Header */}
        <div className="history-header">
          <h2 className="history-title">{t('history.title')}</h2>
          <div className="history-header-actions">
            {history.length > 0 && (
              <button
                className="history-btn-clear"
                onClick={handleClearAll}
                aria-label={t('history.clear_all')}
              >
                {t('history.clear_all')}
              </button>
            )}
            <button
              className="history-close"
              onClick={onClose}
              aria-label={t('history.close')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="history-tabs" role="tablist" aria-label={t('history.title')}>
          <button
            role="tab"
            aria-selected={activeTab === 'queries'}
            className={`history-tab ${activeTab === 'queries' ? 'active' : ''}`}
            onClick={() => setActiveTab('queries')}
          >
            {t('history.recent_queries')}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'activities'}
            className={`history-tab ${activeTab === 'activities' ? 'active' : ''}`}
            onClick={() => setActiveTab('activities')}
          >
            {t('history.recent_activities')}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'data'}
            className={`history-tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            {t('history.processed_data')}
          </button>
        </div>

        {/* Content */}
        <div className="history-content" role="tabpanel">
          {filteredHistory.length === 0 ? (
            <div className="history-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="history-empty-title">{t('history.empty')}</p>
            </div>
          ) : (
            <ul className="history-list" role="list">
              {filteredHistory.map(entry => (
                <li key={entry.id} className="history-item">
                  <div className="history-item-main">
                    <div className="history-item-icon" aria-hidden="true">
                      {entry.activityType === 'ocr' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      )}
                      {entry.activityType === 'translation' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      )}
                      {entry.activityType === 'upload' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      )}
                    </div>
                    <div className="history-item-info">
                      <div className="history-item-title-row">
                        <span className="history-item-title">{entry.title}</span>
                        <span className={`history-status history-status-${entry.status}`}>
                          {t(`history.${entry.status}`)}
                        </span>
                      </div>
                      <div className="history-item-meta">
                        {entry.subtitle && <span className="history-item-subtitle">{entry.subtitle}</span>}
                        <span className="history-item-time">{formatRelativeTime(entry.timestamp)}</span>
                        <span className="history-item-type">{t(`history.${entry.activityType}`)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="history-item-actions">
                    {entry.ocrResult && (
                      <button
                        className="history-btn-restore"
                        onClick={() => handleRestore(entry)}
                        aria-label={t('history.restore')}
                      >
                        {t('history.restore')}
                      </button>
                    )}
                    <button
                      className="history-btn-delete"
                      onClick={() => handleDelete(entry.id)}
                      aria-label={t('history.delete')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* New Query button at bottom */}
          <button
            className="history-new-query"
            onClick={() => { onNewQuery(); onClose(); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('history.new_query')}
          </button>
        </div>
      </aside>
    </>
  );
}