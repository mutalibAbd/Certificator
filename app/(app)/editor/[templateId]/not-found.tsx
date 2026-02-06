import Link from 'next/link'

/**
 * Not Found page for the template editor.
 *
 * Shown when `notFound()` is called from the editor route
 * (e.g., the requested template ID does not exist in the database).
 */
export default function TemplateNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md text-center">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Template not found
        </h2>

        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          The template you&apos;re looking for doesn&apos;t exist or has been
          deleted.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] transition-colors no-underline"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
