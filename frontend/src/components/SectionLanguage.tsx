// SectionLanguage.tsx — OCR language selection with i18n

import { useCallback } from 'react';
import { useI18n } from '../i18n';

interface SectionLanguageProps {
  preview: string | null;
  fileName: string | null;
  language: string;
  onLanguageChange: (lang: string) => void;
  processing: boolean;
  onRunOcr: () => void;
}

// Language options matching new backend's supported languages
const LANG_OPTIONS = [
  { code: 'tam+eng', labelKey: 'language.option_tam_eng' },
  { code: 'tam', labelKey: 'language.option_tam' },
  { code: 'eng', labelKey: 'language.option_eng' },
  { code: 'tam+eng+hin', labelKey: 'language.option_tam_eng_hin' },
  { code: 'tam+hin', labelKey: 'language.option_tam_hin' },
] as const;

export function SectionLanguage({
  preview,
  fileName,
  language,
  onLanguageChange,
  processing,
  onRunOcr,
}: SectionLanguageProps) {
  const { t } = useI18n();

  const handleRadioChange = useCallback(
    (code: string) => {
      onLanguageChange(code);
    },
    [onLanguageChange],
  );

  return (
    <section className="section section-language" aria-labelledby="language-heading">
      <div className="section-content">
        <h2 id="language-heading" className="section-title">
          {t('language.heading')}
        </h2>

        {preview && (
          <div className="image-preview-container">
            <img
              src={preview}
              alt={`${t('upload.aria_label_filled')}: ${fileName ?? t('common.loading')}`}
              className="image-preview-img"
            />
            {fileName && <div className="image-preview-label">{fileName}</div>}
          </div>
        )}

        <div className="language-options" role="radiogroup" aria-label={t('language.heading')}>
          {LANG_OPTIONS.map((opt) => (
            <label
              key={opt.code}
              className={`radio-option ${language === opt.code ? 'active' : ''}`}
            >
              <input
                type="radio"
                name="ocr-language"
                value={opt.code}
                checked={language === opt.code}
                onChange={() => handleRadioChange(opt.code)}
                disabled={processing}
                className="radio-input"
                aria-label={t(opt.labelKey)}
              />
              <span className="radio-custom" aria-hidden="true">
                <span className="radio-dot" />
              </span>
              <span className="radio-label">{t(opt.labelKey)}</span>
            </label>
          ))}
        </div>

        <button
          className="btn-primary btn-run-ocr"
          id="run-ocr-btn"
          onClick={onRunOcr}
          disabled={!preview || processing}
          aria-busy={processing}
        >
          {processing ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              {t('language.processing')}
            </>
          ) : (
            t('language.run_ocr')
          )}
        </button>
      </div>
    </section>
  );
}