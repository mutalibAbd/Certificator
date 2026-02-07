/**
 * EditorToolbar Component
 * 
 * Top toolbar for the certificate editor with navigation, save, and generate actions.
 * Extracted from EditorWorkspace for better modularity.
 */

'use client';

import Link from 'next/link';
import type { ParsedData } from '@/lib/data-parser';

export interface EditorToolbarProps {
    templateName: string;
    isDirty: boolean;
    isSaving: boolean;
    parsedData: ParsedData | null;
    dataFileName: string;
    onSave: () => void;
    onGeneratePDF: () => void;
    onBatchGenerate: () => void;
    onDataFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearData: () => void;
}

export function EditorToolbar({
    templateName,
    isDirty,
    isSaving,
    parsedData,
    dataFileName,
    onSave,
    onGeneratePDF,
    onBatchGenerate,
    onDataFileUpload,
    onClearData,
}: EditorToolbarProps) {
    return (
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
                    {templateName}
                </h1>
                <span
                    className={`text-xs px-2 py-0.5 rounded-full ${isDirty
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
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                {dataFileName} ({parsedData.rows.length} rows)
                            </span>
                            <button
                                type="button"
                                onClick={onClearData}
                                className="p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                                title="Clear data source"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </>
                    ) : (
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-muted)] transition-colors cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            Import Data
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={onDataFileUpload}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>

                {/* Separator */}
                <div className="w-px h-6 bg-[var(--border)]" />

                <button
                    type="button"
                    onClick={onSave}
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
                    onClick={onGeneratePDF}
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
                    onClick={onBatchGenerate}
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
    );
}
