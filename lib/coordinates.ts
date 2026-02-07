/**
 * Coordinate System Utilities
 *
 * This module is the SINGLE SOURCE OF TRUTH for all coordinate conversions
 * between different coordinate systems used in the application.
 *
 * ## Coordinate Systems:
 *
 * 1. **Browser/Canvas Coordinates** (Top-Left Origin)
 *    - Origin: (0, 0) at top-left corner
 *    - X increases rightward
 *    - Y increases downward
 *    - Unit: Pixels
 *
 * 2. **Normalized/Percentage Coordinates** (0-1 Range)
 *    - Origin: (0, 0) at top-left corner
 *    - X: 0 = left edge, 1 = right edge
 *    - Y: 0 = top edge, 1 = bottom edge
 *    - Unit: Percentage (0-1)
 *    - Used for responsive positioning across different display sizes
 *
 * 3. **PDF Coordinates** (Bottom-Left Origin, Points)
 *    - Origin: (0, 0) at bottom-left corner
 *    - X increases rightward
 *    - Y increases upward
 *    - Unit: Points (1pt = 1/72 inch)
 *
 * ## Critical Conversion Formula:
 *
 * Browser Y → PDF Y:  `Y_pdf = PageHeight - Y_browser`
 * PDF Y → Browser Y:  `Y_browser = PageHeight - Y_pdf`
 *
 * ## Usage:
 *
 * ```typescript
 * import { percentageToPoints, browserToPDF } from '@/lib/coordinates';
 *
 * // Convert normalized coords to PDF points
 * const pdfCoord = percentageToPoints({ xPct: 0.5, yPct: 0.3 }, 595.28, 841.89);
 *
 * // Convert browser pixels to PDF points
 * const pdfY = browserYToPdfY(100, 841.89);
 * ```
 */

// ============================================================================
// STANDARD PAGE DIMENSIONS
// ============================================================================

/**
 * Standard page dimensions in PDF points (1pt = 1/72 inch)
 */
export const PAGE_DIMENSIONS = {
    /** A4 (210 × 297 mm) - Most common international format */
    A4: { width: 595.28, height: 841.89 },
    /** US Letter (8.5 × 11 inches) */
    LETTER: { width: 612, height: 792 },
    /** US Legal (8.5 × 14 inches) */
    LEGAL: { width: 612, height: 1008 },
} as const;

/** Default dimensions (A4) */
export const A4_WIDTH = PAGE_DIMENSIONS.A4.width;
export const A4_HEIGHT = PAGE_DIMENSIONS.A4.height;

// ============================================================================
// COORDINATE TYPES
// ============================================================================

/**
 * Browser/Canvas coordinate (pixels, top-left origin)
 */
export interface BrowserCoordinate {
    x: number;
    y: number;
}

/**
 * Normalized/Percentage coordinate (0-1 range, top-left origin)
 */
export interface NormalizedCoordinate {
    xPct: number; // 0-1, percentage of width
    yPct: number; // 0-1, percentage of height
}

/**
 * PDF coordinate (points, bottom-left origin)
 */
export interface PDFCoordinate {
    x: number;
    y: number;
}

/**
 * PDF coordinate in points (explicit naming)
 */
export interface PDFPointCoordinate {
    xPoints: number;
    yPoints: number;
}

// ============================================================================
// BROWSER ↔ PDF CONVERSIONS
// ============================================================================

/**
 * Convert Browser coordinates (top-left origin) to PDF coordinates (bottom-left origin)
 *
 * @param browser - Browser coordinate in pixels
 * @param pageHeight - Height of the PDF page in points/pixels
 * @returns PDF coordinate with inverted Y-axis
 *
 * @example
 * // Top of page in browser (y=0) becomes bottom in PDF (y=pageHeight)
 * browserToPDF({ x: 100, y: 0 }, 841.89)
 * // Returns: { x: 100, y: 841.89 }
 */
export function browserToPDF(
    browser: BrowserCoordinate,
    pageHeight: number
): PDFCoordinate {
    return {
        x: browser.x,
        y: pageHeight - browser.y,
    };
}

/**
 * Convert PDF coordinates (bottom-left origin) to Browser coordinates (top-left origin)
 *
 * @param pdf - PDF coordinate in points
 * @param pageHeight - Height of the PDF page in points
 * @returns Browser coordinate with inverted Y-axis
 */
export function pdfToBrowser(
    pdf: PDFCoordinate,
    pageHeight: number
): BrowserCoordinate {
    return {
        x: pdf.x,
        y: pageHeight - pdf.y,
    };
}

/**
 * Convert Browser Y coordinate to PDF Y coordinate
 * Includes optional font size adjustment for text baseline positioning
 *
 * @param browserY - Y coordinate in browser/canvas system
 * @param pageHeight - Height of the PDF page in points
 * @param fontSize - Optional font size for baseline adjustment
 * @returns Y coordinate in PDF system
 */
export function browserYToPdfY(
    browserY: number,
    pageHeight: number,
    fontSize: number = 0
): number {
    // Y_pdf = PageHeight - Y_browser - fontSize
    // fontSize adjustment accounts for text drawing from baseline
    return pageHeight - browserY - fontSize;
}

/**
 * Convert PDF Y coordinate to Browser Y coordinate
 *
 * @param pdfY - Y coordinate in PDF system
 * @param pageHeight - Height of the PDF page in points
 * @returns Y coordinate in browser/canvas system
 */
export function pdfYToBrowserY(pdfY: number, pageHeight: number): number {
    return pageHeight - pdfY;
}

// ============================================================================
// NORMALIZED ↔ PDF CONVERSIONS
// ============================================================================

/**
 * Convert normalized (percentage) coordinates to PDF points
 *
 * CRITICAL FORMULA:
 * - xPoints = xPct × pdfWidth
 * - yPoints = pdfHeight - (yPct × pdfHeight)
 *
 * The Y-axis inversion is automatic:
 * - Input: (0,0) at top-left, Y increases downward
 * - Output: (0,0) at bottom-left, Y increases upward
 *
 * @param coord - Normalized coordinate (0-1 range)
 * @param pdfWidth - Width of the PDF page in points
 * @param pdfHeight - Height of the PDF page in points
 * @returns PDF coordinate in points
 *
 * @example
 * // Center of page
 * percentageToPoints({ xPct: 0.5, yPct: 0.5 }, 595.28, 841.89)
 * // Returns: { xPoints: 297.64, yPoints: 420.945 }
 *
 * @example
 * // Top-left corner (in browser terms)
 * percentageToPoints({ xPct: 0, yPct: 0 }, 595.28, 841.89)
 * // Returns: { xPoints: 0, yPoints: 841.89 } (top of PDF page)
 */
export function percentageToPoints(
    coord: NormalizedCoordinate,
    pdfWidth: number,
    pdfHeight: number
): PDFPointCoordinate {
    // Clamp to 0-1 range to prevent out-of-bounds
    const xPct = Math.max(0, Math.min(1, coord.xPct));
    const yPct = Math.max(0, Math.min(1, coord.yPct));

    return {
        xPoints: xPct * pdfWidth,
        yPoints: pdfHeight - yPct * pdfHeight,
    };
}

/**
 * Convert PDF points to normalized (percentage) coordinates
 * Inverse of percentageToPoints for round-trip conversions
 *
 * @param points - PDF coordinate in points
 * @param pdfWidth - Width of the PDF page in points
 * @param pdfHeight - Height of the PDF page in points
 * @returns Normalized coordinate (0-1 range)
 */
export function pointsToPercentage(
    points: PDFPointCoordinate,
    pdfWidth: number,
    pdfHeight: number
): NormalizedCoordinate {
    return {
        xPct: points.xPoints / pdfWidth,
        yPct: (pdfHeight - points.yPoints) / pdfHeight,
    };
}

// ============================================================================
// NORMALIZED ↔ BROWSER/PIXEL CONVERSIONS
// ============================================================================

/**
 * Convert normalized coordinates to pixel coordinates
 *
 * @param normalized - Normalized coordinate (0-1 range)
 * @param containerWidth - Width of the container in pixels
 * @param containerHeight - Height of the container in pixels
 * @returns Pixel coordinate
 */
export function normalizedToPixels(
    normalized: NormalizedCoordinate,
    containerWidth: number,
    containerHeight: number
): BrowserCoordinate {
    return {
        x: normalized.xPct * containerWidth,
        y: normalized.yPct * containerHeight,
    };
}

/**
 * Convert pixel coordinates to normalized coordinates
 *
 * @param pixels - Pixel coordinate
 * @param containerWidth - Width of the container in pixels
 * @param containerHeight - Height of the container in pixels
 * @returns Normalized coordinate (0-1 range)
 */
export function pixelsToNormalized(
    pixels: BrowserCoordinate,
    containerWidth: number,
    containerHeight: number
): NormalizedCoordinate {
    return {
        xPct: containerWidth > 0 ? pixels.x / containerWidth : 0,
        yPct: containerHeight > 0 ? pixels.y / containerHeight : 0,
    };
}

/**
 * Clamp normalized coordinates to valid 0-1 range
 *
 * @param coord - Normalized coordinate (may be out of range)
 * @returns Clamped coordinate (guaranteed 0-1)
 */
export function clampNormalized(coord: NormalizedCoordinate): NormalizedCoordinate {
    return {
        xPct: Math.max(0, Math.min(1, coord.xPct)),
        yPct: Math.max(0, Math.min(1, coord.yPct)),
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate the scale factor between container and PDF dimensions
 *
 * @param containerWidth - Width of the display container in pixels
 * @param containerHeight - Height of the display container in pixels
 * @param pdfWidth - Width of the PDF page in points
 * @param pdfHeight - Height of the PDF page in points
 * @returns Scale factor (container / PDF)
 */
export function calculateScale(
    containerWidth: number,
    containerHeight: number,
    pdfWidth: number = A4_WIDTH,
    pdfHeight: number = A4_HEIGHT
): { scaleX: number; scaleY: number; uniformScale: number } {
    const scaleX = containerWidth / pdfWidth;
    const scaleY = containerHeight / pdfHeight;
    const uniformScale = Math.min(scaleX, scaleY);

    return { scaleX, scaleY, uniformScale };
}

/**
 * Check if a normalized coordinate is within bounds (0-1 range)
 *
 * @param coord - Coordinate to check
 * @returns true if coordinate is valid (0-1 for both x and y)
 */
export function isValidNormalized(coord: NormalizedCoordinate): boolean {
    return (
        coord.xPct >= 0 &&
        coord.xPct <= 1 &&
        coord.yPct >= 0 &&
        coord.yPct <= 1
    );
}

// ============================================================================
// LEGACY ALIASES (for backwards compatibility)
// ============================================================================

/** @deprecated Use NormalizedCoordinate instead */
export type PercentageCoordinate = NormalizedCoordinate;
