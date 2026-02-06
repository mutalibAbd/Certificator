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
    const result = await generatePDF(
      {
        layout: layout.config,
        userData: data,
        coordinateMode: 'percentage',
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
    const result = await generateMergedBatchPDF(
      layout.config,
      dataRows,
      'base64',
      {
        coordinateMode: 'percentage',
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
