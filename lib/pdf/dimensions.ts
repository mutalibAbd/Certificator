/**
 * PDF dimension computation utilities.
 *
 * Converts template image pixel dimensions to PDF page dimensions in points.
 * The longest dimension is scaled to 841.89pt (A4 long edge = 297mm).
 */

/** A4 page dimensions in PDF points (1pt = 1/72 inch) */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

/** Maximum PDF dimension in points (= A4 long edge) */
const MAX_DIMENSION_PT = 841.89;

/**
 * Compute PDF page size [width, height] in points from image pixel dimensions.
 *
 * Algorithm:
 *   1. Determine aspect ratio r = widthPx / heightPx
 *   2. Scale so the longest dimension = 841.89pt
 *      - Landscape (w >= h): pdfWidth = 841.89, pdfHeight = 841.89 / r
 *      - Portrait  (h > w):  pdfHeight = 841.89, pdfWidth = 841.89 * r
 *
 * Falls back to A4 (595.28 x 841.89) when dimensions are null/undefined/zero.
 */
export function computePageSize(
  widthPx: number | null | undefined,
  heightPx: number | null | undefined,
): [number, number] {
  if (!widthPx || !heightPx || widthPx <= 0 || heightPx <= 0) {
    return [A4_WIDTH, A4_HEIGHT];
  }

  const r = widthPx / heightPx;

  if (widthPx >= heightPx) {
    // Landscape or square
    return [MAX_DIMENSION_PT, MAX_DIMENSION_PT / r];
  } else {
    // Portrait
    return [MAX_DIMENSION_PT * r, MAX_DIMENSION_PT];
  }
}

/**
 * Compute CSS aspect ratio (width / height) from pixel dimensions.
 * Falls back to A4 portrait aspect ratio when dimensions are null.
 */
export function computeAspectRatio(
  widthPx: number | null | undefined,
  heightPx: number | null | undefined,
): number {
  if (!widthPx || !heightPx || widthPx <= 0 || heightPx <= 0) {
    return A4_WIDTH / A4_HEIGHT;
  }
  return widthPx / heightPx;
}
