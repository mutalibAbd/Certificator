/**
 * PDF Types
 * 
 * Re-exports all types from the PDF generator module.
 * Provides a cleaner import path for type-only imports.
 * 
 * @example
 * import type { UserData, GeneratePDFInput, GeneratePDFResult } from '@/lib/pdf/types';
 */

export type {
    UserData,
    CoordinateMode,
    DebugOptions,
    GeneratePDFInput,
    OutputFormat,
    GeneratePDFResult,
    BatchGenerateOptions,
    PercentageCoordinate,
    PDFPointCoordinate,
} from './generator';
