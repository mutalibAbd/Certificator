/**
 * Unit tests for coordinate conversion functions
 */

import { describe, it, expect } from 'vitest';
import { browserToPDF, pdfToBrowser } from '@/types/database.types';
import { percentageToPoints, pointsToPercentage } from '@/lib/pdf/generator';

describe('Coordinate Conversion', () => {
    describe('browserToPDF', () => {
        it('converts browser coordinates to PDF coordinates', () => {
            const pageHeight = 842;
            const browser = { x: 100, y: 100 };
            const pdf = browserToPDF(browser, pageHeight);

            expect(pdf.x).toBe(100);
            expect(pdf.y).toBe(742); // 842 - 100
        });

        it('handles zero coordinates', () => {
            const pageHeight = 842;
            const browser = { x: 0, y: 0 };
            const pdf = browserToPDF(browser, pageHeight);

            expect(pdf.x).toBe(0);
            expect(pdf.y).toBe(842);
        });

        it('handles coordinates at page bottom', () => {
            const pageHeight = 842;
            const browser = { x: 100, y: 842 };
            const pdf = browserToPDF(browser, pageHeight);

            expect(pdf.x).toBe(100);
            expect(pdf.y).toBe(0);
        });
    });

    describe('pdfToBrowser', () => {
        it('converts PDF coordinates to browser coordinates', () => {
            const pageHeight = 842;
            const pdf = { x: 100, y: 742 };
            const browser = pdfToBrowser(pdf, pageHeight);

            expect(browser.x).toBe(100);
            expect(browser.y).toBe(100);
        });

        it('is the inverse of browserToPDF', () => {
            const pageHeight = 842;
            const original = { x: 150, y: 300 };
            const pdf = browserToPDF(original, pageHeight);
            const backToBrowser = pdfToBrowser(pdf, pageHeight);

            expect(backToBrowser.x).toBe(original.x);
            expect(backToBrowser.y).toBe(original.y);
        });
    });
});

describe('Percentage Coordinate Conversion', () => {
    describe('percentageToPoints', () => {
        it('converts percentage coordinates to PDF points with Y-axis inversion', () => {
            // (0.5, 0.5) = center in percentage space
            // In PDF: x = 0.5 * width, y = height - (0.5 * height) = 0.5 * height
            const percentage = { xPct: 0.5, yPct: 0.5 };
            const width = 595.28;
            const height = 841.89;

            const points = percentageToPoints(percentage, width, height);

            expect(points.xPoints).toBeCloseTo(297.64, 2);
            // Y is inverted: 841.89 - (0.5 * 841.89) = 420.945
            expect(points.yPoints).toBeCloseTo(420.945, 2);
        });

        it('handles 0% coordinates (top-left in browser = top in PDF)', () => {
            // (0, 0) = top-left in percentage space
            // In PDF: y = height - 0 = height (top of page)
            const percentage = { xPct: 0, yPct: 0 };
            const width = 595.28;
            const height = 841.89;

            const points = percentageToPoints(percentage, width, height);

            expect(points.xPoints).toBe(0);
            expect(points.yPoints).toBeCloseTo(height, 2); // Top of PDF page
        });

        it('handles 100% coordinates (bottom-right in browser = bottom in PDF)', () => {
            // (1, 1) = bottom-right in percentage space
            // In PDF: y = height - height = 0 (bottom of page)
            const percentage = { xPct: 1, yPct: 1 };
            const width = 595.28;
            const height = 841.89;

            const points = percentageToPoints(percentage, width, height);

            expect(points.xPoints).toBeCloseTo(width, 2);
            expect(points.yPoints).toBeCloseTo(0, 2); // Bottom of PDF page
        });
    });

    describe('pointsToPercentage', () => {
        it('converts PDF points to percentage coordinates with Y-axis inversion', () => {
            // Point at center of page in PDF terms
            const point = { xPoints: 297.64, yPoints: 420.945 };
            const width = 595.28;
            const height = 841.89;

            const pct = pointsToPercentage(point, width, height);

            expect(pct.xPct).toBeCloseTo(0.5, 2);
            expect(pct.yPct).toBeCloseTo(0.5, 2);
        });

        it('is the inverse of percentageToPoints', () => {
            const original = { xPct: 0.25, yPct: 0.75 };
            const width = 595.28;
            const height = 841.89;

            const points = percentageToPoints(original, width, height);
            const backToPercentage = pointsToPercentage(points, width, height);

            expect(backToPercentage.xPct).toBeCloseTo(original.xPct, 6);
            expect(backToPercentage.yPct).toBeCloseTo(original.yPct, 6);
        });
    });
});
