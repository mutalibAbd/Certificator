/**
 * PDF Module Exports
 *
 * Re-exports all PDF generation utilities
 */

// Main PDF generation functions and types
export {
  generatePDF,
  generateBatchPDF,
  percentageToPoints,
  pointsToPercentage,
  type UserData,
  type GeneratePDFInput,
  type GeneratePDFResult,
  type OutputFormat,
  type CoordinateMode,
  type DebugOptions,
  type PercentageCoordinate,
  type PDFPointCoordinate,
  type BatchGenerateOptions,
} from './generator';
