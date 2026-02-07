/**
 * BatchStepGenerate Component
 * 
 * Step 3: Progress indicator during batch certificate generation.
 */

'use client';

import type { BatchStepGenerateProps } from './types';

export function BatchStepGenerate({
    progress,
    chunkResults,
    totalChunks,
}: BatchStepGenerateProps) {
    const progressPercent =
        progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

    return (
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
                            className={`text-xs px-3 py-1.5 rounded flex justify-between ${r.error
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
}
