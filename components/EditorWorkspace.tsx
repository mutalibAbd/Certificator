/**
 * EditorWorkspace Component
 *
 * The main client-side workspace for the certificate editor. Contains:
 * - Top: EditorToolbar with navigation, save, generate PDF
 * - Left (~70%): PDF preview with CertificateCanvas overlay
 * - Right (~30%): FieldPanel for editing field properties
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

import { useState, useCallback, useTransition, useMemo } from 'react';
import dynamic from 'next/dynamic';

import { CertificateCanvas, createCanvasField, type CanvasField } from '@/components/CertificateCanvas';
import { FieldPanel } from '@/components/FieldPanel';
import { PdfPreview } from '@/components/PdfPreview';
import { EditorToolbar } from '@/components/EditorToolbar';
import { ColumnPickerModal } from '@/components/ColumnPickerModal';
import { useToast } from '@/hooks/useToast';
import { useKeyboardShortcuts, SHORTCUT_KEYS } from '@/hooks/useKeyboardShortcuts';
import { parseDataFile, type ParsedData } from '@/lib/data-parser';
import { saveLayout } from '@/lib/actions/layouts';
import { getAllFontVariableClasses } from '@/lib/fonts';
import type { TemplateWithLayout } from '@/types/database.types';
import type { DataSource, LayoutField } from '@/types/database.types';
import { A4_WIDTH, A4_HEIGHT } from '@/lib/pdf/dimensions';

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
  /** Signed URL for the certificate PDF (private bucket access) */
  pdfSignedUrl?: string;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function EditorWorkspace({ template, pdfSignedUrl }: EditorWorkspaceProps) {
  const { showToast } = useToast();

  /* ---- Template dimensions (direct from PDF, no heuristic) ---- */
  const widthPt = template.width_pt ?? A4_WIDTH;
  const heightPt = template.height_pt ?? A4_HEIGHT;
  const aspectRatio = widthPt / heightPt;
  const pdfPageHeight = heightPt;

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

  /* ---- Keyboard shortcuts ---- */

  const shortcuts = useMemo(() => ({
    [SHORTCUT_KEYS.SAVE]: (e: KeyboardEvent) => {
      e.preventDefault();
      if (isDirty && !isSaving) {
        handleSave();
      }
    },
    [SHORTCUT_KEYS.DELETE]: () => {
      if (selectedFieldId) {
        handleFieldRemove(selectedFieldId);
      }
    },
    [SHORTCUT_KEYS.BACKSPACE]: () => {
      if (selectedFieldId) {
        handleFieldRemove(selectedFieldId);
      }
    },
    [SHORTCUT_KEYS.ESCAPE]: () => {
      setSelectedFieldId(null);
    },
  }), [isDirty, isSaving, handleSave, selectedFieldId, handleFieldRemove]);

  useKeyboardShortcuts(shortcuts);

  /* ---- Render ---- */

  return (
    <div className={`flex flex-col h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 ${getAllFontVariableClasses()}`}>
      {/* ================================================================== */}
      {/*  Top toolbar                                                       */}
      {/* ================================================================== */}
      <EditorToolbar
        templateName={template.name}
        isDirty={isDirty}
        isSaving={isSaving}
        parsedData={parsedData}
        dataFileName={dataFileName}
        onSave={handleSave}
        onGeneratePDF={handleGeneratePDF}
        onBatchGenerate={() => setIsBatchOpen(true)}
        onDataFileUpload={handleDataFileUpload}
        onClearData={handleClearData}
      />

      {/* ================================================================== */}
      {/*  Editor body: canvas + panel                                        */}
      {/* ================================================================== */}
      <div className="flex flex-1 min-h-0">
        {/* Left: PDF preview with canvas overlay (~70%) */}
        <div className="flex-[7] flex items-start justify-center overflow-auto p-6 bg-[var(--background-muted)]">
          <div className="w-full max-w-3xl">
            <PdfPreview
              pdfUrl={pdfSignedUrl || template.pdf_url}
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
            </PdfPreview>
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
