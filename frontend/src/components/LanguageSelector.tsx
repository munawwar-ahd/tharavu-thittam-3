// LanguageSelector.tsx — Compact language switcher for UI language

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

type Locale = 'en' | 'ta' | 'hi';

const LOCALE_OPTIONS: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];

interface LanguageSelectorProps {
  className?: string;
  variant?: 'dropdown' | 'pills';
}

export function LanguageSelector({ className = '', variant = 'dropdown' }: LanguageSelectorProps) {
  const { locale, setLocale, t } = useI18n();

  const current = LOCALE_OPTIONS.find(o => o.code === locale) || LOCALE_OPTIONS[0];

  if (variant === 'pills') {
    return (
      <div className={`language-selector-pills ${className}`} role="group" aria-label={t('lang.selector_label')}>
        {LOCALE_OPTIONS.map(opt => (
          <button
            key={opt.code}
            className={`lang-pill ${locale === opt.code ? 'active' : ''}`}
            onClick={() => setLocale(opt.code)}
            aria-pressed={locale === opt.code}
            aria-label={opt.nativeLabel}
          >
            {opt.nativeLabel}
          </button>
        ))}
      </div>
    );
  }

  // Dropdown variant
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  }, [isOpen]);

  return (
    <div className={`language-selector-dropdown ${className}`} role="combobox" aria-label={t('lang.selector_label')} aria-expanded={isOpen}>
      <button
        ref={triggerRef}
        className="lang-trigger"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="lang-trigger-text">{current.nativeLabel}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`lang-chevron ${isOpen ? 'open' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div ref={dropdownRef} className="lang-dropdown" role="listbox" aria-label={t('lang.selector_label')}>
          {LOCALE_OPTIONS.map(opt => (
            <button
              key={opt.code}
              role="option"
              aria-selected={locale === opt.code}
              className={`lang-option ${locale === opt.code ? 'selected' : ''}`}
              onClick={() => { setLocale(opt.code); setIsOpen(false); }}
            >
              <span className="lang-option-native">{opt.nativeLabel}</span>
              <span className="lang-option-english">{opt.label}</span>
              {locale === opt.code && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="lang-check">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}