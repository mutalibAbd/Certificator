/**
 * BatchGenerateModal Component
 *
 * Modal for batch certificate generation via CSV or Excel import.
 * Refactored to use modular step components.
 *
 * FLOW:
 * 1. Upload CSV/Excel -> parse client-side -> preview + column mapping
 * 2. Confirmation summary
 * 3. Generation with progress indicator
 * 4. Download result / error report
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

import type { CanvasField } from '@/components/CertificateCanvas';
import { generateBatchCertificates } from '@/lib/actions/generate';
import { parseDataFile, type ParsedData } from '@/lib/data-parser';
import { useToast } from '@/hooks/useToast';

import {
  BatchStepInput,
  BatchStepConfirm,
  BatchStepGenerate,
  BatchStepComplete,
  CHUNK_SIZE,
  type BatchStep,
  type ColumnMapping,
  type ChunkResult,
  type BatchProgress,
} from './batch';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface BatchGenerateModalProps {
  templateId: string;
  templateName: string;
  fields: CanvasField[];
  isOpen: boolean;
  onClose: () => void;
  /** Pre-loaded data from the editor's data file upload (skips the file upload step) */
  preloadedData?: ParsedData;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function BatchGenerateModal({
  templateId,
  templateName,
  fields,
  isOpen,
  onClose,
  preloadedData,
}: BatchGenerateModalProps) {
  const { showToast } = useToast();

  /* ---- State ---- */
  const [step, setStep] = useState<BatchStep>('input');
  const [csv, setCsv] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<BatchProgress>({ completed: 0, total: 0 });
  const [chunkResults, setChunkResults] = useState<ChunkResult[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  /* ---- Derived values ---- */
  const mappableFields = fields.filter((f) => f.label && f.label.trim() !== '');
  const allFieldsMapped = mappableFields.every(
    (f) => columnMapping[f.label!] !== undefined && columnMapping[f.label!] !== -1,
  );
  const totalRows = csv?.rows.length ?? 0;
  const totalChunks = Math.ceil(totalRows / CHUNK_SIZE);

  /* ---- Reset state when modal closes ---- */
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setStep('input');
        setCsv(null);
        setFileName('');
        setColumnMapping({});
        setIsGenerating(false);
        setProgress({ completed: 0, total: 0 });
        setChunkResults([]);
        setParseError(null);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  /* ---- Escape key handler ---- */
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isGenerating) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isGenerating, onClose]);

  /* ---- Auto-map CSV headers to field labels (case-insensitive) ---- */
  const autoMapColumns = useCallback(
    (headers: string[]) => {
      const mapping: ColumnMapping = {};
      const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

      for (const field of mappableFields) {
        const label = field.label!.toLowerCase().trim();
        const index = lowerHeaders.indexOf(label);
        mapping[field.label!] = index;
      }

      setColumnMapping(mapping);
    },
    [mappableFields],
  );

  /* ---- Pre-populate with preloaded data when modal opens ---- */
  useEffect(() => {
    if (!isOpen || !preloadedData || csv) return;

    const headers = preloadedData.headers;
    // Defer state updates to avoid synchronous setState in effect
    const timer = setTimeout(() => {
      setCsv(preloadedData);
      setFileName('(imported from editor)');
      autoMapColumns(headers);
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, preloadedData, csv, autoMapColumns]);

  /* ---- File upload handler ---- */
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setParseError(null);
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        setParseError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
        return;
      }

      setFileName(file.name);

      try {
        const parsed = await parseDataFile(file);

        if (parsed.headers.length === 0) {
          setParseError('Could not parse headers from the file');
          setCsv(null);
          return;
        }

        if (parsed.rows.length === 0) {
          setParseError('The file contains headers but no data rows');
          setCsv(null);
          return;
        }

        setCsv(parsed);
        autoMapColumns(parsed.headers);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse file');
        setCsv(null);
      }
    },
    [autoMapColumns],
  );

  /* ---- Column mapping change handler ---- */
  const handleMappingChange = useCallback(
    (fieldLabel: string, csvColumnIndex: number) => {
      setColumnMapping((prev) => ({ ...prev, [fieldLabel]: csvColumnIndex }));
    },
    [],
  );

  /* ---- Build data rows using column mapping ---- */
  const buildMappedRows = useCallback((): Record<string, string>[] => {
    if (!csv) return [];

    return csv.rows.map((row) => {
      const record: Record<string, string> = {};
      for (const field of mappableFields) {
        const label = field.label!;
        const colIndex = columnMapping[label];
        record[label] = colIndex >= 0 && colIndex < row.length ? row[colIndex] : '';
      }
      return record;
    });
  }, [csv, mappableFields, columnMapping]);

  /* ---- Download helper: base64 to Blob download ---- */
  const downloadPDF = useCallback(
    (base64: string, suffix?: string) => {
      const byteCharacters = atob(base64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const name = suffix
        ? `${safeName}_batch_${dateStr}_part${suffix}.pdf`
        : `${safeName}_batch_${dateStr}.pdf`;

      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [templateName],
  );

  /* ---- Generate batch ---- */
  const handleGenerate = useCallback(async () => {
    const allRows = buildMappedRows();
    if (allRows.length === 0) return;

    setIsGenerating(true);
    setStep('generate');
    setProgress({ completed: 0, total: allRows.length });
    setChunkResults([]);

    const results: ChunkResult[] = [];

    for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
      const chunk = allRows.slice(i, i + CHUNK_SIZE);
      const chunkIndex = Math.floor(i / CHUNK_SIZE);

      try {
        const result = await generateBatchCertificates(templateId, chunk);
        results.push({
          chunkIndex,
          data: result.data,
          error: result.error,
          rowStart: i + 1,
          rowEnd: Math.min(i + CHUNK_SIZE, allRows.length),
        });
      } catch {
        results.push({
          chunkIndex,
          data: null,
          error: 'Network error or server timeout',
          rowStart: i + 1,
          rowEnd: Math.min(i + CHUNK_SIZE, allRows.length),
        });
      }

      setProgress({ completed: Math.min(i + CHUNK_SIZE, allRows.length), total: allRows.length });
      setChunkResults([...results]);
    }

    setIsGenerating(false);
    setStep('complete');

    // Auto-download successful results
    const successful = results.filter((r) => r.data);
    if (successful.length === 0) {
      showToast('Batch generation failed. Check the error details.', 'error');
    } else if (successful.length === 1 && results.length === 1) {
      downloadPDF(successful[0].data!);
      showToast('Batch PDF generated and downloaded successfully!', 'success');
    } else {
      for (const r of successful) {
        downloadPDF(r.data!, String(r.chunkIndex + 1));
      }
      showToast(
        `${successful.length} PDF file(s) downloaded. ${results.length - successful.length > 0 ? `${results.length - successful.length} chunk(s) failed.` : ''}`,
        successful.length === results.length ? 'success' : 'info',
      );
    }
  }, [buildMappedRows, templateId, downloadPDF, showToast]);

  /* ---- Backdrop click handler ---- */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !isGenerating) {
        onClose();
      }
    },
    [isGenerating, onClose],
  );

  /* ---- Render guards ---- */
  if (!isOpen) return null;

  /* ---- Step titles ---- */
  const stepTitles: Record<BatchStep, string> = {
    input: 'Import Data',
    confirm: 'Confirm Batch Generation',
    generate: 'Generating Certificates',
    complete: 'Generation Complete',
  };

  /* ---- Render step content ---- */
  const renderStepContent = () => {
    switch (step) {
      case 'input':
        return (
          <BatchStepInput
            csv={csv}
            fileName={fileName}
            parseError={parseError}
            columnMapping={columnMapping}
            mappableFields={mappableFields}
            allFieldsMapped={allFieldsMapped}
            totalRows={totalRows}
            onFileUpload={handleFileUpload}
            onMappingChange={handleMappingChange}
            onNext={() => setStep('confirm')}
            onClose={onClose}
          />
        );
      case 'confirm':
        return (
          <BatchStepConfirm
            templateName={templateName}
            totalRows={totalRows}
            mappableFieldsCount={mappableFields.length}
            totalChunks={totalChunks}
            chunkSize={CHUNK_SIZE}
            onBack={() => setStep('input')}
            onGenerate={handleGenerate}
            onClose={onClose}
          />
        );
      case 'generate':
        return (
          <BatchStepGenerate
            progress={progress}
            chunkResults={chunkResults}
            totalChunks={totalChunks}
          />
        );
      case 'complete':
        return (
          <BatchStepComplete
            chunkResults={chunkResults}
            progress={progress}
            onDownload={downloadPDF}
            onClose={onClose}
          />
        );
    }
  };

  return (
    /* Backdrop */
    <div
      className="z-modal fixed inset-0 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={stepTitles[step]}
    >
      {/* Modal card */}
      <div
        className="
          bg-white rounded-xl shadow-xl
          w-full max-w-2xl mx-4
          max-h-[90vh] flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {stepTitles[step]}
          </h2>
          {!isGenerating && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer p-1 rounded-md hover:bg-[var(--background-muted)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
