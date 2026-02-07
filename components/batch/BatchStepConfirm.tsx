/**
 * BatchStepConfirm Component
 * 
 * Step 2: Confirmation summary before batch generation.
 */

'use client';

import type { BatchStepConfirmProps } from './types';

export function BatchStepConfirm({
    templateName,
    totalRows,
    mappableFieldsCount,
    totalChunks,
    chunkSize,
    onBack,
    onGenerate,
}: BatchStepConfirmProps) {
    return (
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
                        <span className="text-[var(--foreground)] font-medium">{mappableFieldsCount}</span>
                    </div>
                    {totalChunks > 1 && (
                        <div className="flex justify-between">
                            <span className="text-[var(--foreground-muted)]">Batch chunks:</span>
                            <span className="text-[var(--foreground)] font-medium">
                                {totalChunks} ({chunkSize} per chunk)
                            </span>
                        </div>
                    )}
                </div>
                <p className="text-xs text-[var(--foreground-muted)] mt-3">
                    Each certificate will be a blank page with text positioned at your saved coordinates. Print the output on your pre-printed certificate paper.
                </p>
            </div>

            {totalRows > chunkSize && (
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
                        Large batch: {totalRows} certificates will be split into {totalChunks} groups of up to {chunkSize}.
                        Each group will be downloaded as a separate PDF file.
                    </p>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
                <button
                    type="button"
                    onClick={onBack}
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
                    onClick={onGenerate}
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
}
