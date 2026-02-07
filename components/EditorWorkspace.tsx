/**
 * EditorWorkspace Component
 *
 * The main client-side workspace for the certificate editor. Contains:
 * - Left (~70%): PDF preview with CertificateCanvas overlay
 * - Right (~30%): FieldPanel for editing field properties
 * - Top toolbar: navigation, save, generate PDF
 *
 * STATE:
 * - fields: CanvasField[] — the editable field layout
 * - selectedFieldId: string | null — which field is selected
 * - isDirty: boolean — unsaved changes indicator
 * - isSaving: boolean — save-in-progress indicator
 *
 * COORDINATE SYSTEM:
 * - All coordinates are normalized (0-1), never absolute pixels
 * - LayoutField (DB) <-> CanvasField (component) mapping handled here
 */

'use client';

import { useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import { CertificateCanvas, createCanvasField, type CanvasField } from '@/components/CertificateCanvas';
import { FieldPanel } from '@/components/FieldPanel';
import { ImagePreview } from '@/components/ImagePreview';
import { useToast } from '@/hooks/useToast';
import { parseDataFile, type ParsedData } from '@/lib/data-parser';
import { saveLayout } from '@/lib/actions/layouts';
import { getAllFontVariableClasses } from '@/lib/fonts';
import type { TemplateWithLayout } from '@/types/database.types';
import type { DataSource, LayoutField } from '@/types/database.types';
import { computeAspectRatio, computePageSize } from '@/lib/pdf/dimensions';

const BatchGenerateModal = dynamic(
  () => import('@/components/BatchGenerateModal').then(m => m.BatchGenerateModal),
  { ssr: false },
);
const GenerateModal = dynamic(
  () => import('@/components/GenerateModal').then(m => m.GenerateModal),
  { ssr: false },
);

/* -------------------------------------------------------------------------- */
/*  Type mapping helpers                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Convert LayoutField[] (database format) to CanvasField[] (canvas format).
 * The key difference: CanvasField adds a `position` object derived from x/y.
 */
function layoutFieldsToCanvasFields(fields: LayoutField[]): CanvasField[] {
  return fields.map((f) =>
    createCanvasField({
      ...f,
      position: { x: f.x, y: f.y },
    }),
  );
}

/**
 * Convert CanvasField[] (canvas format) back to LayoutField[] (database format).
 * Strips the `position` convenience property and syncs x/y from it.
 */
function canvasFieldsToLayoutFields(fields: CanvasField[]): LayoutField[] {
  return fields.map(({ position, ...rest }) => ({
    ...rest,
    x: position.x,
    y: position.y,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

export interface EditorWorkspaceProps {
  /** The template (with optional layout) fetched on the server */
  template: TemplateWithLayout;
  /** Signed URL for the certificate image (private bucket access) */
  imageSignedUrl?: string;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function EditorWorkspace({ template, imageSignedUrl }: EditorWorkspaceProps) {
  const { showToast } = useToast();

  /* ---- Template dimensions ---- */
  const aspectRatio = computeAspectRatio(template.width_px, template.height_px);
  const [, pdfPageHeight] = computePageSize(template.width_px, template.height_px);

  /* ---- Field state ---- */
  const initialFields: CanvasField[] = template.layout?.config
    ? layoutFieldsToCanvasFields(template.layout.config)
    : [];

  const [fields, setFields] = useState<CanvasField[]>(initialFields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  // Restore persisted data source from layout (if any)
  const storedDataSource = template.layout?.data_source ?? null;
  const [parsedData, setParsedData] = useState<ParsedData | null>(
    storedDataSource
      ? { headers: storedDataSource.headers, rows: storedDataSource.rows }
      : null,
  );
  const [dataFileName, setDataFileName] = useState<string>(
    storedDataSource?.fileName ?? '',
  );
  const [pendingData, setPendingData] = useState<{ data: ParsedData; fileName: string } | null>(null);

  /* ---- Field change handler (from canvas drag or panel edits) ---- */

  const handleFieldsChange = useCallback((updated: CanvasField[]) => {
    setFields(updated);
    setIsDirty(true);
  }, []);

  /* ---- Field update (single field property change from panel) ---- */

  const handleFieldUpdate = useCallback(
    (id: string, updates: Partial<CanvasField>) => {
      setFields((prev) => {
        const idx = prev.findIndex((f) => f.id === id);
        if (idx === -1) return prev;

        const updated = [...prev];
        const field = { ...updated[idx], ...updates };

        // Keep position and x/y in sync when position-related props change
        if (updates.position) {
          field.x = updates.position.x;
          field.y = updates.position.y;
        }

        updated[idx] = field;
        return updated;
      });
      setIsDirty(true);
    },
    [],
  );

  /* ---- Add field ---- */

  const handleFieldAdd = useCallback((type: LayoutField['type'], options?: { label?: string; source?: 'data' | 'static' }) => {
    const newField = createCanvasField({
      id: crypto.randomUUID(),
      type,
      label: options?.label ?? (type === 'date' ? 'Date' : 'New Text'),
      value: type === 'date' ? new Date().toLocaleDateString() : '',
      source: options?.source ?? 'static',
      position: { x: 0.5, y: 0.5 },
    });
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    setIsDirty(true);
  }, []);

  /* ---- Remove field ---- */

  const handleFieldRemove = useCallback(
    (id: string) => {
      setFields((prev) => prev.filter((f) => f.id !== id));
      if (selectedFieldId === id) {
        setSelectedFieldId(null);
      }
      setIsDirty(true);
    },
    [selectedFieldId],
  );

  /* ---- Save ---- */

  const handleSave = useCallback(() => {
    startSaveTransition(async () => {
      try {
        const layoutFields = canvasFieldsToLayoutFields(fields);

        // Build data source payload: current parsedData or null to clear
        const dataSource: DataSource | null = parsedData
          ? { fileName: dataFileName, headers: parsedData.headers, rows: parsedData.rows }
          : null;

        const { error } = await saveLayout(template.id, layoutFields, dataSource);

        if (error) {
          showToast(`Save failed: ${error}`, 'error');
          return;
        }

        setIsDirty(false);
        showToast('Layout saved successfully', 'success');
      } catch {
        showToast('An unexpected error occurred while saving', 'error');
      }
    });
  }, [fields, template.id, showToast, parsedData, dataFileName]);

  /* ---- Generate PDF ---- */

  const handleGeneratePDF = useCallback(() => {
    setIsGenerateOpen(true);
  }, []);

  /* ---- Data file upload ---- */

  const handleDataFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await parseDataFile(file)
      // Store parsed data and show column picker
      setPendingData({ data, fileName: file.name })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to parse file', 'error')
    }
    // Reset the input so the same file can be re-uploaded
    e.target.value = ''
  }, [showToast])

  /* ---- Confirm column selection from picker ---- */

  const handleColumnConfirm = useCallback((selectedHeaders: string[]) => {
    if (!pendingData) return
    const { data, fileName } = pendingData

    // Filter data to only selected columns
    const selectedIndices = selectedHeaders.map(h => data.headers.indexOf(h))
    const filteredData: ParsedData = {
      headers: selectedHeaders,
      rows: data.rows.map(row => selectedIndices.map(i => row[i] || '')),
    }

    setParsedData(filteredData)
    setDataFileName(fileName)

    // Auto-create fields only for the selected columns
    const newFields: CanvasField[] = []
    filteredData.headers.forEach((header, index) => {
      const exists = fields.some(f => f.label?.toLowerCase() === header.toLowerCase())
      if (!exists) {
        newFields.push(createCanvasField({
          id: crypto.randomUUID(),
          label: header,
          type: 'text',
          value: filteredData.rows[0]?.[index] || header,
          font: 'Helvetica',
          size: 16,
          color: '#000000',
          align: 'center',
          position: { x: 0.5, y: 0.15 + index * 0.1 },
          source: 'data',
        }))
      }
    })
    if (newFields.length > 0) {
      setFields(prev => [...prev, ...newFields])
      setIsDirty(true)
    }
    showToast(`Imported ${filteredData.rows.length} rows (${selectedHeaders.length} columns) from ${fileName}`, 'success')
    setPendingData(null)
  }, [pendingData, fields, showToast])

  /* ---- Clear data source ---- */

  const handleClearData = useCallback(() => {
    setParsedData(null)
    setDataFileName('')
    // Remove only data-sourced fields
    setFields(prev => prev.filter(f => f.source !== 'data'))
    setIsDirty(true)
  }, [])

  /* ---- Render ---- */

  return (
    <div className={`flex flex-col h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 ${getAllFontVariableClasses()}`}>
      {/* ================================================================== */}
      {/*  Top toolbar                                                       */}
      {/* ================================================================== */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-[var(--border)] shrink-0">
        {/* Left: Back link */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors no-underline"
        >
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
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Dashboard
        </Link>

        {/* Center: Template name + save status */}
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-[var(--foreground)] truncate max-w-[200px]">
            {template.name}
          </h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isDirty
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {isDirty ? 'Unsaved changes' : 'Saved'}
          </span>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Data source section */}
          <div className="flex items-center gap-2">
            {parsedData ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {dataFileName} ({parsedData.rows.length} rows)
                </span>
                <button
                  type="button"
                  onClick={handleClearData}
                  className="p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  title="Clear data source"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </>
            ) : (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-muted)] transition-colors cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import Data
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleDataFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-[var(--border)]" />

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="
              px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer
              bg-[var(--primary)] text-white
              hover:bg-[var(--primary-hover)]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <span className="loading-spinner w-3.5 h-3.5" />
                Saving...
              </span>
            ) : (
              'Save'
            )}
          </button>

          <button
            type="button"
            onClick={handleGeneratePDF}
            className="
              px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer
              border border-[var(--border)] text-[var(--foreground)]
              hover:bg-[var(--background-muted)]
            "
          >
            Generate PDF
          </button>

          <button
            type="button"
            onClick={() => setIsBatchOpen(true)}
            disabled={!parsedData}
            className="
              px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer
              border border-[var(--border)] text-[var(--foreground)]
              hover:bg-[var(--background-muted)]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Batch Generate
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/*  Editor body: canvas + panel                                        */}
      {/* ================================================================== */}
      <div className="flex flex-1 min-h-0">
        {/* Left: PDF preview with canvas overlay (~70%) */}
        <div className="flex-[7] flex items-start justify-center overflow-auto p-6 bg-[var(--background-muted)]">
          <div className="w-full max-w-3xl">
            <ImagePreview
              imageUrl={imageSignedUrl || template.image_url}
              aspectRatio={aspectRatio}
            >
              <CertificateCanvas
                fields={fields}
                onFieldsChange={handleFieldsChange}
                aspectRatio={aspectRatio}
                pdfPageHeight={pdfPageHeight}
                selectedFieldId={selectedFieldId}
                onFieldSelect={setSelectedFieldId}
                className="w-full h-full"
              />
            </ImagePreview>
          </div>
        </div>

        {/* Right: Field properties panel (~30%) */}
        <div className="flex-[3] min-w-[280px] max-w-[360px]">
          <FieldPanel
            fields={fields}
            selectedFieldId={selectedFieldId}
            onFieldUpdate={handleFieldUpdate}
            onFieldAdd={handleFieldAdd}
            onFieldRemove={handleFieldRemove}
            onFieldSelect={setSelectedFieldId}
          />
        </div>
      </div>

      {/* Generate Single Certificate Modal (only mount when open) */}
      {isGenerateOpen && (
        <GenerateModal
          templateId={template.id}
          templateName={template.name}
          fields={fields}
          isOpen={isGenerateOpen}
          onClose={() => setIsGenerateOpen(false)}
          initialData={parsedData ? Object.fromEntries(
            parsedData.headers.map((h, i) => [h, parsedData.rows[0]?.[i] || ''])
          ) : undefined}
        />
      )}

      {/* Batch Generate Modal (only mount when open) */}
      {isBatchOpen && (
        <BatchGenerateModal
          templateId={template.id}
          templateName={template.name}
          fields={fields}
          isOpen={isBatchOpen}
          onClose={() => setIsBatchOpen(false)}
          preloadedData={parsedData ?? undefined}
        />
      )}

      {/* Column Picker Modal */}
      {pendingData && (
        <ColumnPickerModal
          headers={pendingData.data.headers}
          sampleRow={pendingData.data.rows[0] || []}
          onConfirm={handleColumnConfirm}
          onCancel={() => setPendingData(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Column Picker Modal                                                        */
/* -------------------------------------------------------------------------- */

function ColumnPickerModal({
  headers,
  sampleRow,
  onConfirm,
  onCancel,
}: {
  headers: string[];
  sampleRow: string[];
  onConfirm: (selected: string[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (header: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header);
      else next.add(header);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === headers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(headers));
    }
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Select Columns
          </h2>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            Choose which columns to place on the certificate.
          </p>
        </div>

        {/* Column list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Select all */}
          <label className="flex items-center gap-3 py-2 border-b border-[var(--border)] mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === headers.length}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            <span className="text-sm font-medium text-[var(--foreground)]">Select All</span>
          </label>

          {headers.map((header, i) => (
            <label
              key={header}
              className={`
                flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer transition-colors
                ${selected.has(header) ? 'bg-blue-50' : 'hover:bg-[var(--background-muted)]'}
              `}
            >
              <input
                type="checkbox"
                checked={selected.has(header)}
                onChange={() => toggle(header)}
                className="w-4 h-4 rounded border-[var(--border)] accent-[var(--primary)]"
              />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-[var(--foreground)]">{header}</span>
                {sampleRow[i] && (
                  <span className="ml-2 text-xs text-[var(--foreground-muted)]">
                    e.g. &quot;{sampleRow[i].length > 30 ? sampleRow[i].slice(0, 30) + '...' : sampleRow[i]}&quot;
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)]">
            {selected.size} of {headers.length} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-sm font-medium rounded-md border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-muted)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => onConfirm(headers.filter(h => selected.has(h)))}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Add {selected.size} Field{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
