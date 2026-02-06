import Link from 'next/link'

/**
 * Global 404 Page
 *
 * Displayed when no route matches the requested URL.
 * Uses the project's "Admin Vibe" aesthetic.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-md text-center">
        <p className="text-6xl font-bold text-slate-200">404</p>

        <h2 className="mt-4 text-lg font-semibold text-[var(--foreground)]">
          Page not found
        </h2>

        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] transition-colors no-underline"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
