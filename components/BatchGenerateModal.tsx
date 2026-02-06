/**
 * BatchGenerateModal Component
 *
 * Modal for batch certificate generation via CSV or Excel import.
 *
 * FLOW:
 * 1. Upload CSV/Excel -> parse client-side -> preview + column mapping
 * 2. Confirmation summary
 * 3. Generation with progress indicator
 * 4. Download result / error report
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

import type { CanvasField } from '@/components/CertificateCanvas';
import { generateBatchCertificates } from '@/lib/actions/generate';
import { parseDataFile, type ParsedData } from '@/lib/data-parser';
import { useToast } from '@/hooks/useToast';

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

/** Maps field label -> CSV column index (or -1 if unmapped) */
type ColumnMapping = Record<string, number>;

type Step = 'input' | 'confirm' | 'generate' | 'complete';

interface ChunkResult {
  chunkIndex: number;
  data: string | null;
  error: string | null;
  rowStart: number;
  rowEnd: number;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CHUNK_SIZE = 50;
const PREVIEW_ROW_COUNT = 5;

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- State ---- */
  const [step, setStep] = useState<Step>('input');
  const [csv, setCsv] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
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
      // Delay reset so closing animation can complete
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
        mapping[field.label!] = index; // -1 if not found
      }

      setColumnMapping(mapping);
    },
    [mappableFields],
  );

  /* ---- Pre-populate with preloaded data when modal opens ---- */
  useEffect(() => {
    if (isOpen && preloadedData && !csv) {
      setCsv(preloadedData);
      setFileName('(imported from editor)');
      autoMapColumns(preloadedData.headers);
    }
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

      // Clean up object URL after a brief delay
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

  /* ---- Progress percentage ---- */
  const progressPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  /* ---- Render helpers ---- */

  const renderStepInput = () => (
    <div className="space-y-5">
      {/* File upload */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Upload CSV or Excel File
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="
              px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer
              border border-[var(--border)] text-[var(--foreground)]
              hover:bg-[var(--background-muted)]
            "
          >
            Choose File
          </button>
          <span className="text-sm text-[var(--foreground-muted)] truncate">
            {fileName || 'No file selected'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        {parseError && (
          <p className="mt-2 text-sm text-[var(--error)]">{parseError}</p>
        )}
      </div>

      {/* Data Preview Table */}
      {csv && (
        <>
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">
              Preview ({totalRows} row{totalRows !== 1 ? 's' : ''} total)
            </h3>
            <div className="border border-[var(--border)] rounded-lg overflow-auto max-h-48">
              <table className="w-full text-sm border-collapse min-w-max">
                <thead>
                  <tr className="bg-[var(--background-muted)]">
                    <th className="px-3 py-2 text-left font-medium text-[var(--foreground-muted)] border-b border-[var(--border)] text-xs">
                      #
                    </th>
                    {csv.headers.map((h, i) => (
                      <th
                        key={i}
                        className="px-3 py-2 text-left font-medium text-[var(--foreground-muted)] border-b border-[var(--border)] text-xs whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csv.rows.slice(0, PREVIEW_ROW_COUNT).map((row, ri) => (
                    <tr key={ri} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-1.5 text-[var(--foreground-muted)] text-xs">
                        {ri + 1}
                      </td>
                      {csv.headers.map((_, ci) => (
                        <td
                          key={ci}
                          className="px-3 py-1.5 text-[var(--foreground)] whitespace-nowrap max-w-[200px] truncate"
                        >
                          {row[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalRows > PREVIEW_ROW_COUNT && (
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Showing first {PREVIEW_ROW_COUNT} of {totalRows} rows
              </p>
            )}
          </div>

          {/* Column Mapping */}
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">
              Column Mapping
            </h3>
            {mappableFields.length === 0 ? (
              <p className="text-sm text-[var(--foreground-muted)]">
                No fields with labels found in the template. Add labeled fields in the editor first.
              </p>
            ) : (
              <div className="space-y-2">
                {mappableFields.map((field) => {
                  const label = field.label!;
                  const mappedIndex = columnMapping[label] ?? -1;
                  return (
                    <div key={field.id} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--foreground)] w-32 truncate shrink-0" title={label}>
                        {label}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[var(--foreground-muted)] shrink-0"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                      <select
                        value={mappedIndex}
                        onChange={(e) => handleMappingChange(label, Number(e.target.value))}
                        className={`
                          flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors
                          bg-white text-[var(--foreground)]
                          focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]
                          ${mappedIndex === -1
                            ? 'border-[var(--error)]'
                            : 'border-[var(--border)]'
                          }
                        `}
                      >
                        <option value={-1}>-- Select column --</option>
                        {csv.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Next button */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="
            px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer
            border border-[var(--border)] text-[var(--foreground)]
            hover:bg-[var(--background-muted)]
          "
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setStep('confirm')}
          disabled={!csv || !allFieldsMapped || mappableFields.length === 0}
          className="
            px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer
            bg-[var(--primary)] text-white
            hover:bg-[var(--primary-hover)]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          Next
        </button>
      </div>
    </div>
  );

  const renderStepConfirm = () => (
    <div className="space-y-5">
      <div className="bg-[var(--background-muted)] rounded-lg p-4">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
          Batch Generation Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--foreground-muted)]">Template:</span>
            <span className="text-[var(--foreground)] font-medium">{templateName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--foreground-muted)]">Certificates to generate:</span>
            <span className="text-[var(--foreground)] font-medium">{totalRows}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--foreground-muted)]">Fields mapped:</span>
            <span className="text-[var(--foreground)] font-medium">{mappableFields.length}</span>
          </div>
          {totalChunks > 1 && (
            <div className="flex justify-between">
              <span className="text-[var(--foreground-muted)]">Batch chunks:</span>
              <span className="text-[var(--foreground)] font-medium">
                {totalChunks} (50 per chunk)
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--foreground-muted)] mt-3">
          Each certificate will be a blank page with text positioned at your saved coordinates. Print the output on your pre-printed certificate paper.
        </p>
      </div>

      {totalRows > CHUNK_SIZE && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
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
            className="text-amber-600 shrink-0 mt-0.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm text-amber-800">
            Large batch: {totalRows} certificates will be split into {totalChunks} groups of up to 50.
            Each group will be downloaded as a separate PDF file.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => setStep('input')}
          className="
            px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer
            border border-[var(--border)] text-[var(--foreground)]
            hover:bg-[var(--background-muted)]
          "
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          className="
            px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer
            bg-[var(--primary)] text-white
            hover:bg-[var(--primary-hover)]
          "
        >
          Generate Batch
        </button>
      </div>
    </div>
  );

  const renderStepGenerate = () => (
    <div className="space-y-5">
      <div className="text-center py-4">
        <div className="loading-spinner w-10 h-10 mx-auto mb-4" />
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
          Generating certificates...
        </h3>
        <p className="text-sm text-[var(--foreground-muted)]">
          {progress.completed} / {progress.total} certificates processed
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[var(--background-muted)] rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-[var(--primary)] h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-xs text-[var(--foreground-muted)] text-center">{progressPercent}%</p>

      {/* Chunk status */}
      {chunkResults.length > 0 && totalChunks > 1 && (
        <div className="space-y-1">
          {chunkResults.map((r) => (
            <div
              key={r.chunkIndex}
              className={`text-xs px-3 py-1.5 rounded flex justify-between ${
                r.error
                  ? 'bg-red-50 text-red-700'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              <span>
                Rows {r.rowStart}-{r.rowEnd}
              </span>
              <span>{r.error ? 'Failed' : 'Done'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStepComplete = () => {
    const successful = chunkResults.filter((r) => r.data);
    const failed = chunkResults.filter((r) => r.error);

    return (
      <div className="space-y-5">
        {/* Summary icon */}
        <div className="text-center py-2">
          {failed.length === 0 ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-3"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--warning)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-3"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
          <h3 className="text-sm font-medium text-[var(--foreground)]">
            {failed.length === 0
              ? 'Batch generation complete!'
              : 'Batch generation completed with errors'}
          </h3>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            {successful.length} of {chunkResults.length} chunk{chunkResults.length !== 1 ? 's' : ''} succeeded
            ({progress.total} certificates)
          </p>
        </div>

        {/* Failed chunks detail */}
        {failed.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-[var(--error)]">Failed chunks:</h4>
            {failed.map((r) => (
              <div
                key={r.chunkIndex}
                className="text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                <span className="font-medium text-red-700">
                  Rows {r.rowStart}-{r.rowEnd}:
                </span>{' '}
                <span className="text-red-600">{r.error}</span>
              </div>
            ))}
          </div>
        )}

        {/* Re-download successful chunks */}
        {successful.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--foreground-muted)] mb-2">
              Download again:
            </h4>
            <div className="flex flex-wrap gap-2">
              {successful.map((r) => (
                <button
                  key={r.chunkIndex}
                  type="button"
                  onClick={() =>
                    downloadPDF(
                      r.data!,
                      chunkResults.length > 1 ? String(r.chunkIndex + 1) : undefined,
                    )
                  }
                  className="
                    px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer
                    border border-[var(--border)] text-[var(--foreground)]
                    hover:bg-[var(--background-muted)]
                  "
                >
                  {chunkResults.length > 1
                    ? `Part ${r.chunkIndex + 1} (rows ${r.rowStart}-${r.rowEnd})`
                    : 'Download PDF'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="
              px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer
              bg-[var(--primary)] text-white
              hover:bg-[var(--primary-hover)]
            "
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  /* ---- Step titles ---- */
  const stepTitles: Record<Step, string> = {
    input: 'Import Data',
    confirm: 'Confirm Batch Generation',
    generate: 'Generating Certificates',
    complete: 'Generation Complete',
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
          {step === 'input' && renderStepInput()}
          {step === 'confirm' && renderStepConfirm()}
          {step === 'generate' && renderStepGenerate()}
          {step === 'complete' && renderStepComplete()}
        </div>
      </div>
    </div>
  );
}
