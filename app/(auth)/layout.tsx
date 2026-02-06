/**
 * Auth Layout
 *
 * Wraps /login and /signup pages in a centered card layout.
 * Provides consistent styling for all authentication pages.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center text-3xl font-bold text-[var(--foreground)]">
          Certificator
        </h1>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-bg)] p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
