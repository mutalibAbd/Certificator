/**
 * PDF Coordinate Utilities
 *
 * Re-exports coordinate conversion functions from the central coordinates module.
 * This file exists for backwards compatibility with existing imports.
 *
 * @example
 * import { percentageToPoints, pointsToPercentage } from '@/lib/pdf/coordinates';
 *
 * @deprecated Prefer importing directly from '@/lib/coordinates'
 */

export {
    // Types
    type NormalizedCoordinate,
    type PDFPointCoordinate,
    type BrowserCoordinate,
    type PDFCoordinate,
    type PercentageCoordinate, // legacy alias

    // Normalized ↔ PDF
    percentageToPoints,
    pointsToPercentage,

    // Browser ↔ PDF
    browserToPDF,
    pdfToBrowser,
    browserYToPdfY,
    pdfYToBrowserY,

    // Normalized ↔ Pixels
    normalizedToPixels,
    pixelsToNormalized,
    clampNormalized,

    // Utilities
    calculateScale,
    isValidNormalized,

    // Constants
    A4_WIDTH,
    A4_HEIGHT,
    PAGE_DIMENSIONS,
} from '@/lib/coordinates';
