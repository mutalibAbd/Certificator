/**
 * Dashboard Loading Skeleton
 *
 * Mirrors the dashboard layout: heading area + a responsive grid
 * of 6 skeleton cards that match the TemplateCard structure.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Page heading skeleton */}
      <div className="mb-8 space-y-2">
        <div className="h-7 w-36 rounded bg-slate-200" />
        <div className="h-4 w-56 rounded bg-slate-200" />
      </div>

      {/* Skeleton card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-lg border border-slate-200 bg-white p-5"
          >
            {/* Icon + title area */}
            <div className="flex items-start gap-3">
              {/* Icon placeholder */}
              <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-2">
                {/* Title placeholder */}
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                {/* Date placeholder */}
                <div className="h-3 w-1/2 rounded bg-slate-200" />
              </div>
            </div>

            {/* Button area */}
            <div className="mt-4 flex items-center gap-2 pt-4 border-t border-slate-100">
              <div className="h-7 w-16 rounded-md bg-slate-200" />
              <div className="h-7 w-16 rounded-md bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
