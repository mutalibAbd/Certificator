/**
 * PDF.js setup — client-side only.
 *
 * Configures the pdf.js Web Worker so it parses PDF files off the main thread.
 * Import this module instead of importing pdfjs-dist directly.
 *
 * Uses the minified build for smallest bundle size (~250KB gzipped).
 * The worker is loaded from CDN as a separate resource (not counted toward
 * the main JS bundle).
 *
 * NOTE: Do NOT add pdfjs-dist to serverExternalPackages in next.config.ts.
 * It is a client-side dependency only.
 */

import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export { pdfjsLib };
