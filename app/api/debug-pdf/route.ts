import { NextResponse } from 'next/server'
import { generateDiagnosticPDF } from '@/lib/actions/generate'

/**
 * GET /api/debug-pdf
 *
 * Returns a diagnostic PDF with markers at known percentage positions.
 * Open in a PDF viewer and compare marker positions to their labels:
 *   - TOP-LEFT (10%,10%) should be near the top-left of the page
 *   - CENTER (50%,50%) should be dead center
 *   - BOTTOM-RIGHT (90%,90%) should be near the bottom-right
 *
 * If positions match labels, the coordinate conversion formula is correct.
 */
export async function GET() {
  const { data, error } = await generateDiagnosticPDF()

  if (error || !data) {
    return NextResponse.json(
      { error: error || 'Failed to generate diagnostic PDF' },
      { status: 500 },
    )
  }

  const pdfBytes = Buffer.from(data, 'base64')

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="coordinate-diagnostic.pdf"',
    },
  })
}
