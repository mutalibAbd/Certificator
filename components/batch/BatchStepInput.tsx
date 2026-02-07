/**
 * BatchStepInput Component
 * 
 * Step 1: File upload and column mapping for batch certificate generation.
 */

'use client';

import { useRef } from 'react';
import type { BatchStepInputProps } from './types';
import { PREVIEW_ROW_COUNT } from './types';

export function BatchStepInput({
    csv,
    fileName,
    parseError,
    columnMapping,
    mappableFields,
    allFieldsMapped,
    totalRows,
    onFileUpload,
    onMappingChange,
    onNext,
    onClose,
}: BatchStepInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
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
                        onChange={onFileUpload}
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
                                                onChange={(e) => onMappingChange(label, Number(e.target.value))}
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
                    onClick={onNext}
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
}
