/**
 * GenerateModal Component
 *
 * Modal dialog for generating a single certificate PDF from the editor.
 * Shows a form with one input per layout field, pre-filled with defaults.
 *
 * FEATURES:
 * - Auto-generated form from current canvas fields
 * - Loading state with spinner during generation
 * - Browser download trigger on success
 * - Inline error display on failure
 * - Close on Escape key or backdrop click (disabled while generating)
 * - Accessible: role="dialog", aria-modal, focus trap considerations
 *
 * STYLING: "Admin Vibe" - clean slate/blue palette via CSS variables
 */

'use client'

import { useState, useCallback, useEffect } from 'react'

import type { CanvasField } from '@/components/CertificateCanvas'
import { generateCertificate } from '@/lib/actions/generate'
import { useToast } from '@/hooks/useToast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateModalProps {
  /** UUID of the template being edited */
  templateId: string
  /** Human-readable template name (used for the download filename) */
  templateName: string
  /** Current canvas fields from the editor (used to build the form) */
  fields: CanvasField[]
  /** Whether the modal is currently visible */
  isOpen: boolean
  /** Callback to close the modal */
  onClose: () => void
  /** Pre-populated values from the first row of imported data */
  initialData?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a base64 string to a Blob and trigger a browser download.
 * Creates a temporary <a> element, clicks it, then cleans up.
 */
function downloadBase64Pdf(base64: string, filename: string): void {
  const byteCharacters = atob(base64)
  const byteNumbers = new Uint8Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const blob = new Blob([byteNumbers], { type: 'application/pdf' })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Build a safe filename from the template name and today's date.
 * Strips characters that are invalid in filenames.
 */
function buildFilename(templateName: string): string {
  const safeName = templateName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'certificate'
  const date = new Date().toISOString().split('T')[0]
  return `${safeName}_test_${date}.pdf`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerateModal({
  templateId,
  templateName,
  fields,
  isOpen,
  onClose,
  initialData,
}: GenerateModalProps) {
  const { showToast } = useToast()

  const [formData, setFormData] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only text and date fields can be populated with user values
  const editableFields = fields.filter(
    (f) => f.type === 'text' || f.type === 'date',
  )

  // ---- Initialize form data when modal opens ----
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {}
      for (const field of editableFields) {
        const key = field.label || field.id
        initial[key] = initialData?.[key] ?? field.value ?? ''
      }
      setFormData(initial)
      setError(null)
    }
    // We intentionally only depend on isOpen; editableFields is derived from
    // fields which are stable while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // ---- Escape key handler (blocked while generating) ----
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isGenerating) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isGenerating, onClose])

  // ---- Form input change ----
  const handleInputChange = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }, [])

  // ---- Generate and download ----
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const { data, error: genError } = await generateCertificate(
        templateId,
        formData,
      )

      if (genError || !data) {
        setError(genError || 'Failed to generate certificate')
        return
      }

      // Trigger browser download
      const filename = buildFilename(templateName)
      downloadBase64Pdf(data, filename)

      showToast('Certificate generated successfully', 'success')
      onClose()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }, [templateId, formData, templateName, showToast, onClose])

  // ---- Backdrop click (blocked while generating) ----
  const handleBackdropClick = useCallback(() => {
    if (!isGenerating) {
      onClose()
    }
  }, [isGenerating, onClose])

  // ---- Don't render when closed ----
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Generate certificate"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* ---- Header ---- */}
        <div className="px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Generate Certificate
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              aria-label="Close"
              className="
                p-1 rounded-md text-[var(--foreground-muted)]
                hover:text-[var(--foreground)] hover:bg-[var(--background-muted)]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors cursor-pointer
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            Fill in the field values below to generate your certificate PDF.
          </p>
        </div>

        {/* ---- Body ---- */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {isGenerating ? (
            /* Loading state - prominent per project constitution */
            <div className="flex flex-col items-center justify-center py-12">
              <div className="loading-spinner w-10 h-10 mb-4" />
              <p className="text-sm font-medium text-[var(--foreground)]">
                Generating your certificate...
              </p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                This may take a few seconds
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {editableFields.length === 0 ? (
                <p className="text-sm text-[var(--foreground-muted)] text-center py-8">
                  No editable fields found. Add text or date fields in the
                  editor first.
                </p>
              ) : (
                editableFields.map((field) => {
                  const key = field.label || field.id
                  return (
                    <div key={field.id}>
                      <label
                        htmlFor={`gen-field-${field.id}`}
                        className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                      >
                        {field.label || field.id}
                      </label>
                      <input
                        id={`gen-field-${field.id}`}
                        type="text"
                        value={formData[key] ?? ''}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        placeholder={`Enter ${field.label || field.type}...`}
                        className="
                          w-full px-3 py-2 text-sm rounded-md
                          border border-[var(--border)]
                          bg-white text-[var(--foreground)]
                          placeholder:text-[var(--foreground-muted)]
                          focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                          transition-colors
                        "
                      />
                    </div>
                  )
                })
              )}

              {/* Ghost layer note */}
              <p className="text-xs text-[var(--foreground-muted)] mt-3 px-1">
                This generates a blank page with text only — print on your pre-printed certificate paper.
              </p>

              {/* Inline error display */}
              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 mt-2">
                  <div className="flex items-start gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 mt-0.5 text-red-500"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Footer ---- */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="
              px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer
              border border-[var(--border)] text-[var(--foreground)]
              hover:bg-[var(--background-muted)]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || editableFields.length === 0}
            className="
              px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer
              bg-[var(--primary)] text-white
              hover:bg-[var(--primary-hover)]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="loading-spinner w-4 h-4" />
                Generating...
              </span>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
