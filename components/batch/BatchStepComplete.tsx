/**
 * BatchStepComplete Component
 * 
 * Step 4: Results summary with download options after batch generation.
 */

'use client';

import type { BatchStepCompleteProps } from './types';

export function BatchStepComplete({
    chunkResults,
    progress,
    onDownload,
    onClose,
}: BatchStepCompleteProps) {
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
                                    onDownload(
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
}
