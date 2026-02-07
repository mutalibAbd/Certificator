/**
 * Unit tests for the central coordinates module
 *
 * Tests all coordinate conversion functions between:
 * - Browser coordinates (top-left origin, pixels)
 * - Normalized coordinates (0-1 range)
 * - PDF coordinates (bottom-left origin, points)
 */

import { describe, it, expect } from 'vitest';
import {
    // Types
    type BrowserCoordinate,
    type NormalizedCoordinate,
    type PDFCoordinate,
    type PDFPointCoordinate,

    // Constants
    A4_WIDTH,
    A4_HEIGHT,
    PAGE_DIMENSIONS,

    // Browser ↔ PDF
    browserToPDF,
    pdfToBrowser,
    browserYToPdfY,
    pdfYToBrowserY,

    // Normalized ↔ PDF
    percentageToPoints,
    pointsToPercentage,

    // Normalized ↔ Pixels
    normalizedToPixels,
    pixelsToNormalized,
    clampNormalized,

    // Utilities
    calculateScale,
    isValidNormalized,
} from '@/lib/coordinates';

// ============================================================================
// CONSTANTS
// ============================================================================

describe('Page Dimension Constants', () => {
    it('exports correct A4 dimensions', () => {
        expect(A4_WIDTH).toBe(595.28);
        expect(A4_HEIGHT).toBe(841.89);
    });

    it('exports PAGE_DIMENSIONS with multiple formats', () => {
        expect(PAGE_DIMENSIONS.A4.width).toBe(595.28);
        expect(PAGE_DIMENSIONS.A4.height).toBe(841.89);
        expect(PAGE_DIMENSIONS.LETTER.width).toBe(612);
        expect(PAGE_DIMENSIONS.LETTER.height).toBe(792);
        expect(PAGE_DIMENSIONS.LEGAL.width).toBe(612);
        expect(PAGE_DIMENSIONS.LEGAL.height).toBe(1008);
    });
});

// ============================================================================
// BROWSER ↔ PDF CONVERSIONS
// ============================================================================

describe('Browser to PDF Conversions', () => {
    const pageHeight = A4_HEIGHT;

    describe('browserToPDF', () => {
        it('converts browser coordinates to PDF coordinates', () => {
            const browser: BrowserCoordinate = { x: 100, y: 100 };
            const pdf = browserToPDF(browser, pageHeight);

            expect(pdf.x).toBe(100);
            expect(pdf.y).toBeCloseTo(pageHeight - 100, 2);
        });

        it('converts top-left corner (0,0) to top of PDF page', () => {
            const browser: BrowserCoordinate = { x: 0, y: 0 };
            const pdf = browserToPDF(browser, pageHeight);

            expect(pdf.x).toBe(0);
            expect(pdf.y).toBeCloseTo(pageHeight, 2);
        });

        it('converts bottom of browser to bottom of PDF', () => {
            const browser: BrowserCoordinate = { x: 100, y: pageHeight };
            const pdf = browserToPDF(browser, pageHeight);

            expect(pdf.x).toBe(100);
            expect(pdf.y).toBe(0);
        });

        it('preserves X coordinate unchanged', () => {
            const browser: BrowserCoordinate = { x: 250, y: 100 };
            const pdf = browserToPDF(browser, pageHeight);

            expect(pdf.x).toBe(250);
        });
    });

    describe('pdfToBrowser', () => {
        it('converts PDF coordinates to browser coordinates', () => {
            const pdf: PDFCoordinate = { x: 100, y: 741.89 };
            const browser = pdfToBrowser(pdf, pageHeight);

            expect(browser.x).toBe(100);
            expect(browser.y).toBeCloseTo(100, 2);
        });

        it('is the inverse of browserToPDF', () => {
            const original: BrowserCoordinate = { x: 150, y: 300 };
            const pdf = browserToPDF(original, pageHeight);
            const roundTrip = pdfToBrowser(pdf, pageHeight);

            expect(roundTrip.x).toBe(original.x);
            expect(roundTrip.y).toBeCloseTo(original.y, 2);
        });
    });

    describe('browserYToPdfY', () => {
        it('converts browser Y to PDF Y', () => {
            const browserY = 100;
            const pdfY = browserYToPdfY(browserY, pageHeight);

            expect(pdfY).toBeCloseTo(pageHeight - 100, 2);
        });

        it('adjusts for font size when provided', () => {
            const browserY = 100;
            const fontSize = 12;
            const pdfY = browserYToPdfY(browserY, pageHeight, fontSize);

            expect(pdfY).toBeCloseTo(pageHeight - 100 - fontSize, 2);
        });
    });

    describe('pdfYToBrowserY', () => {
        it('converts PDF Y to browser Y', () => {
            const pdfY = 741.89;
            const browserY = pdfYToBrowserY(pdfY, pageHeight);

            expect(browserY).toBeCloseTo(100, 2);
        });
    });
});

// ============================================================================
// NORMALIZED ↔ PDF CONVERSIONS
// ============================================================================

describe('Normalized to PDF Conversions', () => {
    const width = A4_WIDTH;
    const height = A4_HEIGHT;

    describe('percentageToPoints', () => {
        it('converts center (0.5, 0.5) correctly', () => {
            const normalized: NormalizedCoordinate = { xPct: 0.5, yPct: 0.5 };
            const points = percentageToPoints(normalized, width, height);

            expect(points.xPoints).toBeCloseTo(width / 2, 2);
            expect(points.yPoints).toBeCloseTo(height / 2, 2);
        });

        it('converts top-left (0, 0) to top of PDF', () => {
            const normalized: NormalizedCoordinate = { xPct: 0, yPct: 0 };
            const points = percentageToPoints(normalized, width, height);

            expect(points.xPoints).toBe(0);
            expect(points.yPoints).toBeCloseTo(height, 2); // Top in PDF
        });

        it('converts bottom-right (1, 1) to bottom of PDF', () => {
            const normalized: NormalizedCoordinate = { xPct: 1, yPct: 1 };
            const points = percentageToPoints(normalized, width, height);

            expect(points.xPoints).toBeCloseTo(width, 2);
            expect(points.yPoints).toBe(0); // Bottom in PDF
        });

        it('clamps out-of-range values to 0-1', () => {
            const normalized: NormalizedCoordinate = { xPct: 1.5, yPct: -0.5 };
            const points = percentageToPoints(normalized, width, height);

            // xPct should be clamped to 1, yPct to 0
            expect(points.xPoints).toBeCloseTo(width, 2);
            expect(points.yPoints).toBeCloseTo(height, 2);
        });
    });

    describe('pointsToPercentage', () => {
        it('converts center point correctly', () => {
            const points: PDFPointCoordinate = {
                xPoints: width / 2,
                yPoints: height / 2,
            };
            const normalized = pointsToPercentage(points, width, height);

            expect(normalized.xPct).toBeCloseTo(0.5, 4);
            expect(normalized.yPct).toBeCloseTo(0.5, 4);
        });

        it('is the inverse of percentageToPoints', () => {
            const original: NormalizedCoordinate = { xPct: 0.25, yPct: 0.75 };
            const points = percentageToPoints(original, width, height);
            const roundTrip = pointsToPercentage(points, width, height);

            expect(roundTrip.xPct).toBeCloseTo(original.xPct, 6);
            expect(roundTrip.yPct).toBeCloseTo(original.yPct, 6);
        });
    });
});

// ============================================================================
// NORMALIZED ↔ PIXELS CONVERSIONS
// ============================================================================

describe('Normalized to Pixels Conversions', () => {
    const containerWidth = 800;
    const containerHeight = 600;

    describe('normalizedToPixels', () => {
        it('converts center (0.5, 0.5) correctly', () => {
            const normalized: NormalizedCoordinate = { xPct: 0.5, yPct: 0.5 };
            const pixels = normalizedToPixels(normalized, containerWidth, containerHeight);

            expect(pixels.x).toBe(400);
            expect(pixels.y).toBe(300);
        });

        it('converts edges correctly', () => {
            const bottomRight: NormalizedCoordinate = { xPct: 1, yPct: 1 };
            const pixels = normalizedToPixels(bottomRight, containerWidth, containerHeight);

            expect(pixels.x).toBe(800);
            expect(pixels.y).toBe(600);
        });
    });

    describe('pixelsToNormalized', () => {
        it('converts center correctly', () => {
            const pixels: BrowserCoordinate = { x: 400, y: 300 };
            const normalized = pixelsToNormalized(pixels, containerWidth, containerHeight);

            expect(normalized.xPct).toBe(0.5);
            expect(normalized.yPct).toBe(0.5);
        });

        it('handles zero dimensions gracefully', () => {
            const pixels: BrowserCoordinate = { x: 100, y: 100 };
            const normalized = pixelsToNormalized(pixels, 0, 0);

            expect(normalized.xPct).toBe(0);
            expect(normalized.yPct).toBe(0);
        });

        it('is the inverse of normalizedToPixels', () => {
            const original: NormalizedCoordinate = { xPct: 0.33, yPct: 0.67 };
            const pixels = normalizedToPixels(original, containerWidth, containerHeight);
            const roundTrip = pixelsToNormalized(pixels, containerWidth, containerHeight);

            expect(roundTrip.xPct).toBeCloseTo(original.xPct, 6);
            expect(roundTrip.yPct).toBeCloseTo(original.yPct, 6);
        });
    });

    describe('clampNormalized', () => {
        it('clamps values greater than 1', () => {
            const normalized: NormalizedCoordinate = { xPct: 1.5, yPct: 2.0 };
            const clamped = clampNormalized(normalized);

            expect(clamped.xPct).toBe(1);
            expect(clamped.yPct).toBe(1);
        });

        it('clamps values less than 0', () => {
            const normalized: NormalizedCoordinate = { xPct: -0.5, yPct: -1.0 };
            const clamped = clampNormalized(normalized);

            expect(clamped.xPct).toBe(0);
            expect(clamped.yPct).toBe(0);
        });

        it('leaves valid values unchanged', () => {
            const normalized: NormalizedCoordinate = { xPct: 0.5, yPct: 0.75 };
            const clamped = clampNormalized(normalized);

            expect(clamped.xPct).toBe(0.5);
            expect(clamped.yPct).toBe(0.75);
        });
    });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

describe('Utility Functions', () => {
    describe('calculateScale', () => {
        it('calculates correct scale factors', () => {
            const containerWidth = 600;
            const containerHeight = 800;
            const scale = calculateScale(containerWidth, containerHeight);

            // Using A4 dimensions by default
            expect(scale.scaleX).toBeCloseTo(600 / A4_WIDTH, 4);
            expect(scale.scaleY).toBeCloseTo(800 / A4_HEIGHT, 4);
            expect(scale.uniformScale).toBe(Math.min(scale.scaleX, scale.scaleY));
        });

        it('uses custom PDF dimensions when provided', () => {
            const containerWidth = 612;
            const containerHeight = 792;
            const scale = calculateScale(containerWidth, containerHeight, 612, 792);

            expect(scale.scaleX).toBe(1);
            expect(scale.scaleY).toBe(1);
            expect(scale.uniformScale).toBe(1);
        });
    });

    describe('isValidNormalized', () => {
        it('returns true for valid coordinates', () => {
            expect(isValidNormalized({ xPct: 0, yPct: 0 })).toBe(true);
            expect(isValidNormalized({ xPct: 1, yPct: 1 })).toBe(true);
            expect(isValidNormalized({ xPct: 0.5, yPct: 0.5 })).toBe(true);
        });

        it('returns false for out-of-range x', () => {
            expect(isValidNormalized({ xPct: 1.1, yPct: 0.5 })).toBe(false);
            expect(isValidNormalized({ xPct: -0.1, yPct: 0.5 })).toBe(false);
        });

        it('returns false for out-of-range y', () => {
            expect(isValidNormalized({ xPct: 0.5, yPct: 1.1 })).toBe(false);
            expect(isValidNormalized({ xPct: 0.5, yPct: -0.1 })).toBe(false);
        });
    });
});
