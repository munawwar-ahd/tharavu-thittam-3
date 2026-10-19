// SectionUpload.tsx — Image/PDF upload/drop zone with i18n

import { useCallback, useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { useI18n } from '../i18n';

interface SectionUploadProps {
  file: File | null;
  preview: string | null;
  onFileSelect: (file: File) => void;
  onRemoveFile: () => void;
  error: string | null;
  isProcessing?: boolean;
}

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.tiff,.tif,.bmp,.pdf';
const ALLOWED_MIME = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif', 'image/bmp',
  'image/x-tiff', 'image/x-bmp', 'application/pdf'
];
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.pdf'];

export function SectionUpload({ file, preview, onFileSelect, onRemoveFile, error, isProcessing }: SectionUploadProps) {
  const { t } = useI18n();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelect(dropped);
  }, [onFileSelect]);

  const handleClick = useCallback(() => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  }, [isProcessing]);

  const handleFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) onFileSelect(selected);
    e.target.value = '';
  }, [onFileSelect]);

  const validateFile = (f: File): boolean => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    return ALLOWED_MIME.includes(f.type) || ALLOWED_EXT.includes(ext);
  };

  const isPDF = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');

  return (
    <section className="section section-upload" aria-labelledby="upload-heading">
      <div className="section-content">
        {/* Hidden heading for accessibility */}
        <h1 id="upload-heading" className="section-title" style={{ textAlign: 'center' }}>
          {t('upload.heading')}
        </h1>

        <div
          ref={dropZoneRef}
          className={`drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''} ${isPDF ? 'is-pdf' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!file && !isProcessing ? handleClick : undefined}
          role={!file && !isProcessing ? 'button' : undefined}
          tabIndex={!file && !isProcessing ? 0 : undefined}
          onKeyDown={!file && !isProcessing
            ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }
            : undefined
          }
          aria-label={file ? (isPDF ? t('upload.aria_label_pdf') : t('upload.aria_label_filled')) : t('upload.aria_label_empty')}
          aria-disabled={isProcessing}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileInput}
            onClick={(e) => e.stopPropagation()}
            className="drop-zone-input"
            aria-hidden="true"
            tabIndex={-1}
            disabled={isProcessing}
          />

          {!file ? (
            <>
              {/* Upload icon */}
              <div className="drop-zone-icon" aria-hidden="true">
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="drop-zone-text">{t('upload.drop_text')}</p>
              <p className="drop-zone-subtext">{t('upload.drop_subtext')}</p>
              <p className="drop-zone-subtext" style={{ marginTop: '8px', fontSize: '11px', opacity: 0.7 }}>
                {t('upload.drop_subtext_pdf')}
              </p>
            </>
          ) : (
            <>
              {isPDF ? (
                <div className="drop-zone-pdf-preview" aria-hidden="true">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="10" y2="9.01" />
                    <line x1="14" y1="9" x2="14" y2="9.01" />
                  </svg>
                </div>
              ) : (
                preview && (
                  <div className="drop-zone-preview">
                    <img src={preview} alt="Uploaded image preview" />
                  </div>
                )
              )}
              <p className="drop-zone-filename">{file.name}</p>
              <p className="drop-zone-filesize">
                {(file.size / 1024).toFixed(1)} KB
                {file.type ? ` · ${file.type}` : ''}
              </p>
              <div className="drop-zone-actions">
                <button
                  className="drop-zone-replace"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick();
                  }}
                  aria-label={t('upload.replace')}
                  disabled={isProcessing}
                >
                  {t('upload.replace')}
                </button>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="upload-error" role="alert" aria-live="assertive">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {file && !validateFile(file) && (
          <div className="upload-error" role="alert">
            <span>{t('upload.error_unsupported')}</span>
          </div>
        )}

        {file && (
          <button
            className="btn-remove"
            onClick={(e) => { e.stopPropagation(); onRemoveFile(); }}
            aria-label={t('upload.remove')}
            type="button"
            disabled={isProcessing}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            {t('upload.remove')}
          </button>
        )}
      </div>
    </section>
  );
}