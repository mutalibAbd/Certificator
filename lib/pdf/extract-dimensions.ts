/**
 * PDF dimension extraction — client-side only.
 *
 * Uses pdfjs-dist to extract page dimensions from a File object.
 * This module is dynamically imported by UploadModal to keep pdfjs-dist
 * off the critical path and out of server bundles.
 */

import { pdfjsLib } from './pdfjs-setup';

export interface PdfDimensions {
  widthPt: number;
  heightPt: number;
  pageCount: number;
}

/**
 * Extract PDF page dimensions from a File object (client-side).
 *
 * Uses pdfjs-dist at scale=1 which returns coordinates in PDF points
 * (1pt = 1/72 inch). Only reads page 1.
 */
export async function extractPdfDimensions(file: File): Promise<PdfDimensions> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 }); // scale=1 = PDF points

  return {
    widthPt: viewport.width,
    heightPt: viewport.height,
    pageCount: pdf.numPages,
  };
}
