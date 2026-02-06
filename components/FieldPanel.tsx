/**
 * FieldPanel Component
 *
 * Right-side properties panel for the certificate editor.
 * Shows a list of all fields and, when one is selected, exposes
 * its typography / positioning properties for editing.
 *
 * DESIGN:
 * - "Admin Vibe" — slate grays + blue accent
 * - No external UI component libraries
 * - Changes apply immediately (parent handles save)
 */

'use client';

import { useCallback, useState } from 'react';
import { FieldTypeBadge } from '@/components/DraggableField';
import { FONT_OPTIONS, FONT_REGISTRY, FONT_SIZE_PRESETS, type FontSizePreset } from '@/lib/fonts';
import type { CanvasField } from '@/components/CertificateCanvas';
import type { LayoutField } from '@/types/database.types';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface FieldPanelProps {
  /** All fields on the canvas */
  fields: CanvasField[];
  /** Currently selected field ID (null = nothing selected) */
  selectedFieldId: string | null;
  /** Update one or more properties on a field */
  onFieldUpdate: (id: string, updates: Partial<CanvasField>) => void;
  /** Add a new field of the given type */
  onFieldAdd: (type: LayoutField['type'], options?: { label?: string; source?: 'data' | 'static' }) => void;
  /** Remove a field by id */
  onFieldRemove: (id: string) => void;
  /** Select a field by id */
  onFieldSelect: (id: string | null) => void;
}

/* -------------------------------------------------------------------------- */
/*  Font options                                                              */
/* -------------------------------------------------------------------------- */

const SIZE_OPTIONS: { label: string; value: number }[] = (
  Object.entries(FONT_SIZE_PRESETS) as [FontSizePreset, number][]
).map(([label, value]) => ({ label: `${label} (${value}px)`, value }));

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function FieldPanel({
  fields,
  selectedFieldId,
  onFieldUpdate,
  onFieldAdd,
  onFieldRemove,
  onFieldSelect,
}: FieldPanelProps) {
  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  /* ---- state for "Add Static Field" inline form ---- */
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');

  /* ---- helpers ---- */

  const handlePropertyChange = useCallback(
    <K extends keyof CanvasField>(key: K, value: CanvasField[K]) => {
      if (!selectedFieldId) return;

      // For position-related properties, keep x/y and position in sync
      const updates: Partial<CanvasField> = { [key]: value };
      onFieldUpdate(selectedFieldId, updates);
    },
    [selectedFieldId, onFieldUpdate],
  );

  return (
    <aside
      className="flex flex-col h-full bg-white border-l border-[var(--border)] overflow-hidden"
      aria-label="Field properties panel"
    >
      {/* ------------------------------------------------------------------ */}
      {/*  Field list                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">
            Fields
          </h2>

          {fields.length === 0 && (
            <p className="text-xs text-[var(--foreground-muted)] italic">
              No fields yet. Add one below.
            </p>
          )}

          <ul className="space-y-1" role="listbox" aria-label="Certificate fields">
            {fields.map((field) => {
              const isActive = field.id === selectedFieldId;
              const isDataField = field.source === 'data';
              return (
                <li
                  key={field.id}
                  role="option"
                  aria-selected={isActive}
                  className={`
                    flex items-center justify-between gap-2
                    rounded-md px-3 py-2 text-sm cursor-pointer
                    transition-colors
                    ${
                      isActive
                        ? 'bg-[var(--primary-light)] border border-[var(--border-focus)]'
                        : 'hover:bg-[var(--background-muted)] border border-transparent'
                    }
                  `}
                  onClick={() => onFieldSelect(field.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FieldTypeBadge type={field.type} />
                    <span className="truncate text-[var(--foreground)]">
                      {field.label || field.value || `[${field.type}]`}
                    </span>
                    {/* Source badge */}
                    {isDataField ? (
                      <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700">
                        Data
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600">
                        Static
                      </span>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    aria-label={`Remove field ${field.label || field.type}`}
                    className="shrink-0 text-[var(--foreground-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFieldRemove(field.id);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
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
                </li>
              );
            })}
          </ul>
        </div>

        {/* Add static field */}
        <div className="px-4 pb-4">
          {!isAddingField ? (
            <button
              type="button"
              className="
                w-full px-3 py-2 text-xs font-medium rounded-md
                border border-[var(--border)] text-[var(--foreground)]
                hover:bg-[var(--background-muted)] transition-colors cursor-pointer
              "
              onClick={() => setIsAddingField(true)}
            >
              + Add Static Field
            </button>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const label = newFieldLabel.trim();
                if (!label) return;
                onFieldAdd('text', { label, source: 'static' });
                setNewFieldLabel('');
                setIsAddingField(false);
              }}
            >
              <input
                type="text"
                autoFocus
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="Field label..."
                className="
                  flex-1 rounded-md border border-[var(--border)] bg-white
                  px-3 py-1.5 text-xs text-[var(--foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]
                "
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setNewFieldLabel('');
                    setIsAddingField(false);
                  }
                }}
              />
              <button
                type="submit"
                className="
                  px-3 py-1.5 text-xs font-medium rounded-md
                  bg-[var(--primary)] text-white
                  hover:opacity-90 transition-opacity cursor-pointer
                "
              >
                Add
              </button>
            </form>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/*  Properties (shown when a field is selected)                      */}
        {/* ---------------------------------------------------------------- */}
        {selectedField && (
          <div className="border-t border-[var(--border)] px-4 py-4 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Properties
            </h3>

            {/* Label */}
            <FieldInput
              label="Label"
              value={selectedField.label ?? ''}
              onChange={(v) => handlePropertyChange('label', v)}
              readOnly={selectedField.source === 'data'}
            />

            {/* Default Value */}
            <FieldInput
              label="Default Value"
              value={selectedField.value ?? ''}
              onChange={(v) => handlePropertyChange('value', v)}
            />

            {/* Font */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--foreground-muted)]">
                Font
              </label>
              <select
                value={selectedField.font}
                onChange={(e) => handlePropertyChange('font', e.target.value)}
                className="
                  w-full rounded-md border border-[var(--border)] bg-white
                  px-3 py-1.5 text-sm text-[var(--foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]
                "
              >
                {FONT_OPTIONS.map((fontKey) => (
                  <option key={fontKey} value={fontKey}>
                    {FONT_REGISTRY[fontKey]?.name ?? fontKey}
                  </option>
                ))}
              </select>
            </div>

            {/* Size */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--foreground-muted)]">
                Size
              </label>
              <select
                value={selectedField.size}
                onChange={(e) =>
                  handlePropertyChange('size', Number(e.target.value))
                }
                className="
                  w-full rounded-md border border-[var(--border)] bg-white
                  px-3 py-1.5 text-sm text-[var(--foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]
                "
              >
                {SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--foreground-muted)]">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedField.color || '#000000'}
                  onChange={(e) =>
                    handlePropertyChange('color', e.target.value)
                  }
                  className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer p-0"
                />
                <input
                  type="text"
                  value={selectedField.color || '#000000'}
                  onChange={(e) =>
                    handlePropertyChange('color', e.target.value)
                  }
                  className="
                    flex-1 rounded-md border border-[var(--border)] bg-white
                    px-3 py-1.5 text-sm text-[var(--foreground)] font-mono
                    focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]
                  "
                  maxLength={7}
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Bold & Italic toggles */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedField.bold ?? false}
                  onChange={(e) =>
                    handlePropertyChange('bold', e.target.checked)
                  }
                  className="rounded border-[var(--border)] accent-[var(--primary)]"
                />
                <span className="font-bold">Bold</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedField.italic ?? false}
                  onChange={(e) =>
                    handlePropertyChange('italic', e.target.checked)
                  }
                  className="rounded border-[var(--border)] accent-[var(--primary)]"
                />
                <span className="italic">Italic</span>
              </label>
            </div>

            {/* Alignment */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--foreground-muted)]">
                Alignment
              </label>
              <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                {(['left', 'center', 'right'] as const).map((align) => {
                  const isActive = (selectedField.align ?? 'center') === align;
                  return (
                    <button
                      key={align}
                      type="button"
                      aria-label={`Align ${align}`}
                      aria-pressed={isActive}
                      className={`
                        flex-1 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer
                        ${
                          isActive
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-white text-[var(--foreground)] hover:bg-[var(--background-muted)]'
                        }
                      `}
                      onClick={() => handlePropertyChange('align', align)}
                    >
                      {align === 'left' && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                      )}
                      {align === 'center' && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
                      )}
                      {align === 'right' && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rotation */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--foreground-muted)]">
                Rotation
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={selectedField.rotation ?? 0}
                  onChange={(e) =>
                    handlePropertyChange('rotation', Number(e.target.value))
                  }
                  className="flex-1 accent-[var(--primary)] cursor-pointer"
                />
                <input
                  type="number"
                  min={0}
                  max={359}
                  value={selectedField.rotation ?? 0}
                  onChange={(e) => {
                    let v = Number(e.target.value) || 0;
                    v = ((v % 360) + 360) % 360;
                    handlePropertyChange('rotation', v);
                  }}
                  className="
                    w-16 rounded-md border border-[var(--border)] bg-white
                    px-2 py-1.5 text-sm text-[var(--foreground)] text-center font-mono
                    focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]
                  "
                />
                <span className="text-xs text-[var(--foreground-muted)]">°</span>
              </div>
            </div>
          </div>
        )}

        {/* Hint when nothing is selected */}
        {!selectedField && fields.length > 0 && (
          <div className="border-t border-[var(--border)] px-4 py-6 text-center">
            <p className="text-xs text-[var(--foreground-muted)]">
              Select a field to edit its properties
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reusable text input                                                       */
/* -------------------------------------------------------------------------- */

function FieldInput({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-[var(--foreground-muted)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`
          w-full rounded-md border border-[var(--border)] bg-white
          px-3 py-1.5 text-sm text-[var(--foreground)]
          focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]
          ${readOnly ? 'bg-slate-50 text-[var(--foreground-muted)] cursor-not-allowed' : ''}
        `}
      />
    </div>
  );
}
