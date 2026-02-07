// NOTE: The Supabase Storage bucket 'templates' accepts PDF files only.

'use client'

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type FormEvent,
  type DragEvent,
  type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { createTemplate } from '@/lib/actions/templates'
import { useToast } from '@/hooks/useToast'
import type { PdfDimensions } from '@/lib/pdf/extract-dimensions'

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_MIME_TYPES = new Set(['application/pdf'])
const ACCEPTED_EXTENSIONS = new Set(['.pdf'])

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [pdfDimensions, setPdfDimensions] = useState<PdfDimensions | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { showToast } = useToast()

  /* ---------------------------------------------------------------------- */
  /*  Close on Escape key                                                    */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  /* ---------------------------------------------------------------------- */
  /*  Lock body scroll while open                                            */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  /* ---------------------------------------------------------------------- */
  /*  Reset form when modal closes                                           */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setFile(null)
      setError(null)
      setIsUploading(false)
      setIsDragOver(false)
      setPdfDimensions(null)
    }
  }, [isOpen])

  /* ---------------------------------------------------------------------- */
  /*  File validation                                                        */
  /* ---------------------------------------------------------------------- */
  const validateFile = useCallback((f: File): string | null => {
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
    if (!ACCEPTED_MIME_TYPES.has(f.type) && !ACCEPTED_EXTENSIONS.has(ext)) {
      return 'Please select a PDF file'
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return `File size (${formatFileSize(f.size)}) exceeds the 10 MB limit`
    }
    return null
  }, [])

  const handleFileSelect = useCallback(
    (f: File) => {
      const validationError = validateFile(f)
      if (validationError) {
        setError(validationError)
        setFile(null)
        setPdfDimensions(null)
        return
      }
      setError(null)
      setFile(f)

      // Extract PDF dimensions (dynamic import to keep pdfjs-dist off critical path)
      import('@/lib/pdf/extract-dimensions')
        .then(({ extractPdfDimensions }) => extractPdfDimensions(f))
        .then(setPdfDimensions)
        .catch(() => setPdfDimensions(null))
    },
    [validateFile]
  )

  /* ---------------------------------------------------------------------- */
  /*  Drag-and-drop handlers                                                 */
  /* ---------------------------------------------------------------------- */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        handleFileSelect(droppedFile)
      }
    },
    [handleFileSelect]
  )

  /* ---------------------------------------------------------------------- */
  /*  File input change                                                      */
  /* ---------------------------------------------------------------------- */
  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        handleFileSelect(selectedFile)
      }
    },
    [handleFileSelect]
  )

  /* ---------------------------------------------------------------------- */
  /*  Submit / Upload                                                        */
  /* ---------------------------------------------------------------------- */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!file || !name.trim()) {
      setError('Please provide a template name and select a PDF file')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // 1. Get the authenticated user (client-side)
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error(authError?.message ?? 'Not authenticated')
      }

      // 2. Upload PDF directly to Supabase Storage (bypasses Vercel body limit)
      const fileId = crypto.randomUUID()
      const storagePath = `${user.id}/${fileId}.pdf`

      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(storagePath, file, {
          contentType: 'application/pdf',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      // 3. Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('templates')
        .getPublicUrl(storagePath)

      // 4. Create the template record via server action
      const { error: createError } = await createTemplate(
        name.trim(),
        urlData.publicUrl,
        pdfDimensions?.widthPt ?? null,
        pdfDimensions?.heightPt ?? null,
      )

      if (createError) {
        // Best-effort cleanup: remove the uploaded file if DB insert fails
        await supabase.storage.from('templates').remove([storagePath])
        throw new Error(createError)
      }

      // 5. Success
      showToast('Template uploaded successfully', 'success')
      onClose()
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setError(message)
    } finally {
      setIsUploading(false)
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Backdrop click                                                         */
  /* ---------------------------------------------------------------------- */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close when clicking the backdrop itself, not the modal content
      if (e.target === e.currentTarget && !isUploading) {
        onClose()
      }
    },
    [onClose, isUploading]
  )

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  if (!isOpen) return null

  return (
    <div
      className="z-modal fixed inset-0 flex items-center justify-center bg-black/50 px-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Upload template"
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Upload New Template
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-md p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Template name input */}
          <div>
            <label
              htmlFor="template-name"
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              Template Name
            </label>
            <input
              id="template-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual Award Certificate"
              disabled={isUploading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-slate-400 focus:border-[var(--border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] transition-colors disabled:opacity-50"
            />
          </div>

          {/* Drag-and-drop zone */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Certificate PDF
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors cursor-pointer
                ${
                  isDragOver
                    ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                    : file
                      ? 'border-[var(--success)] bg-green-50'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                }
                ${isUploading ? 'pointer-events-none opacity-50' : ''}
              `}
            >
              {file ? (
                /* File selected – PDF info */
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-16 w-16 rounded-md bg-slate-100 border border-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate max-w-[280px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {formatFileSize(file.size)}
                      {pdfDimensions && ` \u2022 ${pdfDimensions.widthPt.toFixed(0)} \u00d7 ${pdfDimensions.heightPt.toFixed(0)} pt`}
                    </p>
                    {pdfDimensions && pdfDimensions.pageCount > 1 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        {pdfDimensions.pageCount} pages detected — only page 1 will be used
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Drop zone prompt */
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={
                      isDragOver
                        ? 'text-[var(--primary)]'
                        : 'text-[var(--foreground-muted)]'
                    }
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                    Drag &amp; drop your certificate PDF or{' '}
                    <span className="font-medium text-[var(--primary)]">
                      click to browse
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    PDF only, max 10MB
                  </p>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileInputChange}
                className="hidden"
                aria-label="Select PDF file"
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isUploading ? (
                <>
                  <span className="loading-spinner inline-block h-4 w-4" />
                  Uploading...
                </>
              ) : (
                'Upload'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
