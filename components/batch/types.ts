/**
 * Batch Generate Types
 * Shared types for batch certificate generation components
 */

import type { CanvasField } from '@/components/CertificateCanvas';
import type { ParsedData } from '@/lib/data-parser';

/** Maps field label -> CSV column index (or -1 if unmapped) */
export type ColumnMapping = Record<string, number>;

/** Multi-step wizard step type */
export type BatchStep = 'input' | 'confirm' | 'generate' | 'complete';

/** Result of processing a chunk of certificates */
export interface ChunkResult {
    chunkIndex: number;
    data: string | null;
    error: string | null;
    rowStart: number;
    rowEnd: number;
}

/** Progress tracking for batch generation */
export interface BatchProgress {
    completed: number;
    total: number;
}

/** Common props shared across step components */
export interface BatchStepBaseProps {
    onClose: () => void;
}

/** Props for the input step (file upload + column mapping) */
export interface BatchStepInputProps extends BatchStepBaseProps {
    csv: ParsedData | null;
    fileName: string;
    parseError: string | null;
    columnMapping: ColumnMapping;
    mappableFields: CanvasField[];
    allFieldsMapped: boolean;
    totalRows: number;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMappingChange: (fieldLabel: string, csvColumnIndex: number) => void;
    onNext: () => void;
}

/** Props for the confirmation step */
export interface BatchStepConfirmProps extends BatchStepBaseProps {
    templateName: string;
    totalRows: number;
    mappableFieldsCount: number;
    totalChunks: number;
    chunkSize: number;
    onBack: () => void;
    onGenerate: () => void;
}

/** Props for the generation progress step */
export interface BatchStepGenerateProps {
    progress: BatchProgress;
    chunkResults: ChunkResult[];
    totalChunks: number;
}

/** Props for the completion step */
export interface BatchStepCompleteProps extends BatchStepBaseProps {
    chunkResults: ChunkResult[];
    progress: BatchProgress;
    onDownload: (base64: string, suffix?: string) => void;
}

/** Constants */
export const CHUNK_SIZE = 50;
export const PREVIEW_ROW_COUNT = 5;
