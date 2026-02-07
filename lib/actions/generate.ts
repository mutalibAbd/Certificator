'use server'

/**
 * PDF Generation Server Actions
 *
 * AGENT: Backend Engineer
 *
 * Server-side actions for generating certificate PDFs.
 * Uses the existing PDF generation engine at lib/pdf/generator.ts.
 *
 * DEFENSIVE CODING:
 * - Auth check on every call (RLS alone is not enough for server actions)
 * - Input validation (batch size limit, empty fields check)
 * - try-catch with descriptive error messages
 * - { data, error } return pattern throughout
 *
 * COORDINATE SYSTEM:
 * - The canvas stores coordinates as normalized (0-1) percentages
 * - The PDF generator is called with coordinateMode: 'percentage'
 *   so it handles the Browser-to-PDF Y-axis inversion internally
 */

import { createClient } from '@/utils/supabase/server'
import { getTemplate } from '@/lib/actions/templates'
import { generatePDF, generateMergedBatchPDF } from '@/lib/pdf/generator'
import { A4_WIDTH, A4_HEIGHT } from '@/lib/pdf/dimensions'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { LayoutField } from '@/types/database.types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum certificates in a single batch request (memory guard) */
const MAX_BATCH_SIZE = 50

// ---------------------------------------------------------------------------
// Single Certificate Generation
// ---------------------------------------------------------------------------

/**
 * Generate a single certificate PDF.
 *
 * Flow:
 * 1. Authenticate the user
 * 2. Fetch the template (includes its layout via getTemplate)
 * 3. Validate that a layout with fields exists
 * 4. Call the PDF generator with percentage coordinate mode
 * 5. Return the generated PDF as a base64 string
 *
 * @param templateId - UUID of the template to generate from
 * @param data - User-provided field values keyed by field label
 * @returns { data: base64 string | null, error: string | null }
 */
export async function generateCertificate(
  templateId: string,
  data: Record<string, string>,
): Promise<{ data: string | null; error: string | null }> {
  try {
    // ---- Auth check ----
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { data: null, error: authError?.message ?? 'Not authenticated' }
    }

    // ---- Fetch template + layout ----
    const { data: template, error: templateError } = await getTemplate(templateId)

    if (templateError || !template) {
      return { data: null, error: templateError ?? 'Template not found' }
    }

    const layout = template.layout
    if (!layout) {
      return { data: null, error: 'No layout found for this template' }
    }

    if (!layout.config || layout.config.length === 0) {
      return { data: null, error: 'No fields configured' }
    }

    // ---- Generate PDF ----
    // The generator's getUserDataValue checks by field.id first, then
    // field.label, then falls back to field.value. The modal sends data
    // keyed by label, so the label match path handles the mapping.
    const pageSize: [number, number] = [
      template.width_pt ?? A4_WIDTH,
      template.height_pt ?? A4_HEIGHT,
    ]

    const result = await generatePDF(
      {
        layout: layout.config,
        userData: data,
        coordinateMode: 'percentage',
        pageSize,
      },
      'base64',
    )

    return { data: result.data as string, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate certificate'
    console.error('[generateCertificate]', message)
    return { data: null, error: message }
  }
}

// ---------------------------------------------------------------------------
// Single Certificate Generation (Client-Side Layout)
// ---------------------------------------------------------------------------

/**
 * Generate a single certificate PDF using client-provided layout fields.
 *
 * KEY DIFFERENCE from generateCertificate:
 * - Uses the layout fields passed from the client (current canvas state)
 * - Does NOT re-fetch from the database
 * - This ensures the PDF matches exactly what the user sees on the canvas,
 *   even if they haven't saved yet
 *
 * @param templateId - UUID of the template (used for auth verification)
 * @param layoutFields - Current layout fields from the canvas
 * @param data - User-provided field values keyed by field label
 * @param options - Optional settings (debug mode)
 * @returns { data: base64 string | null, error: string | null }
 */
export async function generateCertificateFromLayout(
  templateId: string,
  layoutFields: LayoutField[],
  data: Record<string, string>,
  options?: { debug?: boolean },
): Promise<{ data: string | null; error: string | null }> {
  try {
    // ---- Auth check ----
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { data: null, error: authError?.message ?? 'Not authenticated' }
    }

    // ---- Verify ownership (template must belong to user) ----
    const { data: template, error: templateError } = await getTemplate(templateId)
    if (templateError || !template) {
      return { data: null, error: templateError ?? 'Template not found' }
    }

    // ---- Validate layout ----
    if (!layoutFields || layoutFields.length === 0) {
      return { data: null, error: 'No fields configured' }
    }

    // ---- Generate PDF with client-provided layout ----
    const pageSize: [number, number] = [
      template.width_pt ?? A4_WIDTH,
      template.height_pt ?? A4_HEIGHT,
    ]

    const result = await generatePDF(
      {
        layout: layoutFields,
        userData: data,
        coordinateMode: 'percentage',
        pageSize,
        debug: options?.debug
          ? {
            enabled: true,
            showBoundingBoxes: true,
            showPositionMarkers: true,
          }
          : undefined,
      },
      'base64',
    )

    return { data: result.data as string, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate certificate'
    console.error('[generateCertificateFromLayout]', message)
    return { data: null, error: message }
  }
}

// ---------------------------------------------------------------------------
// Batch Certificate Generation
// ---------------------------------------------------------------------------

/**
 * Generate multiple certificates from the same template and merge into
 * a single PDF document.
 *
 * Flow:
 * 1. Validate batch size (max 50)
 * 2. Authenticate the user
 * 3. Fetch template + layout
 * 4. Call generateMergedBatchPDF which creates a single PDFDocument.create()
 *    with one page per data row (fonts loaded once, shared across all pages)
 * 5. Return the merged PDF as a base64 string
 *
 * MEMORY NOTE:
 * - Batch is capped at 50 to stay within Vercel's 1024 MB function limit
 * - Uses generateMergedBatchPDF which builds all pages in a single document
 *   (no intermediate PDFs, no load/merge step needed)
 *
 * @param templateId - UUID of the template to generate from
 * @param dataRows - Array of user-provided field value records
 * @returns { data: base64 string | null, error: string | null }
 */
export async function generateBatchCertificates(
  templateId: string,
  dataRows: Record<string, string>[],
): Promise<{ data: string | null; error: string | null }> {
  try {
    // ---- Input validation ----
    if (!dataRows || dataRows.length === 0) {
      return { data: null, error: 'No data rows provided' }
    }

    if (dataRows.length > MAX_BATCH_SIZE) {
      return {
        data: null,
        error: `Batch limit exceeded: maximum ${MAX_BATCH_SIZE} certificates per request (received ${dataRows.length})`,
      }
    }

    // ---- Auth check ----
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { data: null, error: authError?.message ?? 'Not authenticated' }
    }

    // ---- Fetch template + layout ----
    const { data: template, error: templateError } = await getTemplate(templateId)

    if (templateError || !template) {
      return { data: null, error: templateError ?? 'Template not found' }
    }

    const layout = template.layout
    if (!layout) {
      return { data: null, error: 'No layout found for this template' }
    }

    if (!layout.config || layout.config.length === 0) {
      return { data: null, error: 'No fields configured' }
    }

    // ---- Generate merged multi-page PDF (single document, all pages created directly) ----
    const pageSize: [number, number] = [
      template.width_pt ?? A4_WIDTH,
      template.height_pt ?? A4_HEIGHT,
    ]

    const result = await generateMergedBatchPDF(
      layout.config,
      dataRows,
      'base64',
      {
        coordinateMode: 'percentage',
        pageSize,
      },
    )

    return { data: result.data as string, error: null }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to generate batch certificates'
    console.error('[generateBatchCertificates]', message)
    return { data: null, error: message }
  }
}

// ---------------------------------------------------------------------------
// Diagnostic: Coordinate System Test PDF
// ---------------------------------------------------------------------------

/**
 * Generate a diagnostic PDF that places labeled markers at known percentage
 * positions.  Open this PDF and compare to the canvas — if the labels match
 * their visual position, the coordinate conversion is correct.
 */
export async function generateDiagnosticPDF(): Promise<{
  data: string | null
  error: string | null
}> {
  try {
    const A4W = 595.28
    const A4H = 841.89

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([A4W, A4H])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontSize = 14

    // Helper: convert percentage (0-1, top-left origin) to PDF points
    const pct = (xPct: number, yPct: number) => ({
      x: xPct * A4W,
      y: A4H - yPct * A4H,
    })

    // Draw page border
    page.drawRectangle({
      x: 0, y: 0, width: A4W, height: A4H,
      borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1,
    })

    // Draw center cross-hairs
    page.drawLine({ start: { x: A4W / 2, y: 0 }, end: { x: A4W / 2, y: A4H }, color: rgb(0.85, 0.85, 0.85), thickness: 0.5 })
    page.drawLine({ start: { x: 0, y: A4H / 2 }, end: { x: A4W, y: A4H / 2 }, color: rgb(0.85, 0.85, 0.85), thickness: 0.5 })

    // Markers: [label, xPct, yPct]
    const markers: [string, number, number][] = [
      ['TOP-LEFT (10%,10%)', 0.1, 0.1],
      ['TOP-RIGHT (90%,10%)', 0.9, 0.1],
      ['CENTER (50%,50%)', 0.5, 0.5],
      ['BOTTOM-LEFT (10%,90%)', 0.1, 0.9],
      ['BOTTOM-RIGHT (90%,90%)', 0.9, 0.9],
    ]

    for (const [label, xPct, yPct] of markers) {
      const { x, y } = pct(xPct, yPct)

      // Draw crosshair at point
      const sz = 10
      page.drawLine({ start: { x: x - sz, y }, end: { x: x + sz, y }, color: rgb(1, 0, 0), thickness: 1 })
      page.drawLine({ start: { x, y: y - sz }, end: { x, y: y + sz }, color: rgb(1, 0, 0), thickness: 1 })

      // Draw label
      const tw = font.widthOfTextAtSize(label, fontSize)
      page.drawText(label, {
        x: x - tw / 2,
        y: y - fontSize - 4,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })

      // Draw the raw numbers
      const info = `pdf-points: (${x.toFixed(1)}, ${y.toFixed(1)})`
      const iw = font.widthOfTextAtSize(info, 9)
      page.drawText(info, {
        x: x - iw / 2,
        y: y - fontSize - 16,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })
    }

    // Title
    page.drawText('COORDINATE SYSTEM DIAGNOSTIC', {
      x: 50, y: A4H - 30, size: 18, font, color: rgb(0, 0, 0),
    })
    page.drawText('If labels match their visual position, Y-inversion is correct.', {
      x: 50, y: A4H - 50, size: 10, font, color: rgb(0.4, 0.4, 0.4),
    })

    const pdfBytes = await pdfDoc.save()
    const base64 = Buffer.from(pdfBytes).toString('base64')
    return { data: base64, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Diagnostic failed'
    console.error('[generateDiagnosticPDF]', message)
    return { data: null, error: message }
  }
}
