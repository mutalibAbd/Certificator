'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteTemplate } from '@/lib/actions/templates'
import { useToast } from '@/hooks/useToast'
import type { Template } from '@/types/database.types'

interface TemplateCardProps {
  template: Template
  signedPdfUrl?: string
}

/**
 * Format a date string into a human-readable format.
 * Example: "Jan 15, 2025"
 */
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function TemplateCard({ template }: TemplateCardProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { showToast } = useToast()

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${template.name}"? This action cannot be undone.`
    )
    if (!confirmed) return

    startTransition(async () => {
      const { error } = await deleteTemplate(template.id)
      if (error) {
        showToast(`Failed to delete: ${error}`, 'error')
      } else {
        showToast('Template deleted successfully', 'success')
        router.refresh()
      }
    })
  }

  return (
    <div className="group relative flex flex-col rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md overflow-hidden">
      {/* Thumbnail */}
      <div className="relative h-32 bg-slate-100 overflow-hidden">
        <div className="flex items-center justify-center h-full text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
      </div>

      {/* Template info */}
      <div className="flex-1 p-5">
        {/* PDF icon + name */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-[var(--primary-light)] p-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-[var(--foreground)] truncate">
              {template.name}
            </h3>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              Created {formatDate(template.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mx-5 mb-5 flex items-center gap-2 pt-4 border-t border-slate-100">
        <Link
          href={`/editor/${template.id}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-hover)] transition-colors no-underline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </Link>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? (
            <>
              <span className="loading-spinner inline-block h-3 w-3" />
              Deleting...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </>
          )}
        </button>
      </div>
    </div>
  )
}
