'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Props for PdfPreview component
 */
export interface PdfPreviewProps {
  /** Signed URL of the certificate PDF */
  pdfUrl: string;
  /** Aspect ratio width/height (default: A4 = 595.28/841.89) */
  aspectRatio?: number;
  /** Children rendered on top of the PDF (typically CertificateCanvas) */
  children?: ReactNode;
}

/** Minimum resize delta (px) before re-rendering the canvas */
const RESIZE_THRESHOLD = 50;

/** Debounce delay (ms) for resize observer callbacks */
const RESIZE_DEBOUNCE_MS = 150;

/**
 * PdfPreview - Render page 1 of a PDF template onto a <canvas> element.
 *
 * Replaces ImagePreview for the PDF-only workflow. Uses pdfjs-dist
 * (dynamically imported) to parse and render the first page.
 *
 * Key behaviour:
 * - ResizeObserver re-renders when the container size changes by >50px
 * - Renders at devicePixelRatio (capped at 2x) for crisp display
 * - Caches the PDFDocumentProxy and PDFPageProxy to avoid re-parsing
 * - Debounces resize events (150ms) to prevent render storms
 * - Shows a loading spinner until the canvas is painted
 * - Children are overlaid via position: absolute (same as old ImagePreview)
 */
export function PdfPreview({
  pdfUrl,
  aspectRatio = 595.28 / 841.89,
  children,
}: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageRef = useRef<any>(null);
  const lastRenderedWidthRef = useRef<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadAndRender() {
      try {
        const [{ pdfjsLib }, { fetchPDFWithCache }] = await Promise.all([
          import('@/lib/pdf/pdfjs-setup'),
          import('@/lib/pdf/pdf-cache'),
        ]);

        // Load PDF (cache the document proxy)
        if (!pdfDocRef.current) {
          // Use IndexedDB cache for faster subsequent loads
          // Falls back to network fetch if not cached
          const arrayBuffer = await fetchPDFWithCache(pdfUrl);
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          pdfDocRef.current = await loadingTask.promise;
        }

        const pdf = pdfDocRef.current;

        // Cache page proxy (page 1 only)
        if (!pageRef.current) {
          pageRef.current = await pdf.getPage(1);
        }

        const page = pageRef.current;

        async function renderPage() {
          if (cancelled || !canvasRef.current || !containerRef.current) return;

          const container = containerRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const containerWidth = container.clientWidth;

          // Skip re-render if container width hasn't changed meaningfully
          if (
            lastRenderedWidthRef.current > 0 &&
            Math.abs(containerWidth - lastRenderedWidthRef.current) < RESIZE_THRESHOLD
          ) {
            return;
          }

          const dpr = Math.min(window.devicePixelRatio || 1, 2);

          // Scale PDF to fit container width
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth / baseViewport.width) * dpr;
          const viewport = page.getViewport({ scale });

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${containerWidth}px`;
          canvas.style.height = `${containerWidth / (baseViewport.width / baseViewport.height)}px`;

          await page.render({ canvasContext: ctx, viewport }).promise;

          lastRenderedWidthRef.current = containerWidth;

          if (!cancelled) {
            setIsLoading(false);
          }
        }

        await renderPage();

        // Debounced re-render on container resize
        resizeObserver = new ResizeObserver(() => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            renderPage();
          }, RESIZE_DEBOUNCE_MS);
        });
        if (containerRef.current) {
          resizeObserver.observe(containerRef.current);
        }
      } catch (err) {
        console.error('[PdfPreview] Failed to load/render PDF:', err);
        if (!cancelled) {
          let msg = err instanceof Error ? err.message : 'Failed to render PDF';

          if (msg.includes('403')) {
            msg = 'Session expired. Please refresh the page.';
          }

          setError(msg);
          setIsLoading(false);
        }
      }
    }

    loadAndRender();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      resizeObserver?.disconnect();
    };
  }, [pdfUrl]);

  // Reset when URL changes
  useEffect(() => {
    pdfDocRef.current = null;
    pageRef.current = null;
    lastRenderedWidthRef.current = 0;
    setIsLoading(true);
    setError(null);
  }, [pdfUrl]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg bg-white shadow"
      style={{ aspectRatio }}
    >
      {/* PDF canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Loading spinner */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="loading-spinner w-8 h-8" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-4">
          <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-400 mb-2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-sm text-slate-500">Unable to preview PDF</p>
            <p className="text-xs text-red-400 mt-1 max-w-xs break-words">{error}</p>
          </div>
        </div>
      )}

      {/* Children overlay (CertificateCanvas) */}
      <div className="absolute inset-0 z-canvas">
        {children}
      </div>
    </div>
  );
}
