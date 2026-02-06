/**
 * Generic Loading Skeleton for authenticated routes.
 *
 * Shown as the Suspense fallback for any `(app)` page that
 * does not provide its own `loading.tsx`.
 */
export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header placeholder */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-slate-200" />
        <div className="h-4 w-64 rounded bg-slate-200" />
      </div>

      {/* Content block placeholders */}
      <div className="space-y-4">
        <div className="h-40 w-full rounded-lg bg-slate-200" />
        <div className="h-40 w-full rounded-lg bg-slate-200" />
        <div className="h-24 w-3/4 rounded-lg bg-slate-200" />
      </div>
    </div>
  )
}
