'use client'

import Link from 'next/link'

/**
 * Error Boundary for authenticated routes.
 *
 * Shown when an unhandled error occurs inside `(app)` pages.
 * Provides a "Try again" action (calls Next.js `reset()`) and
 * a fallback link back to the dashboard.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        {/* Error icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--error)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Something went wrong
        </h2>

        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          {error.message}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
          >
            Try again
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:bg-slate-50 transition-colors no-underline"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
