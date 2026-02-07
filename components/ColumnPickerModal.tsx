/**
 * ColumnPickerModal Component
 * 
 * Modal for selecting which columns from imported data to create as fields.
 * Extracted from EditorWorkspace for better modularity.
 */

'use client';

import { useState } from 'react';

export interface ColumnPickerModalProps {
    headers: string[];
    sampleRow: string[];
    onConfirm: (selected: string[]) => void;
    onCancel: () => void;
}

export function ColumnPickerModal({
    headers,
    sampleRow,
    onConfirm,
    onCancel,
}: ColumnPickerModalProps) {
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
