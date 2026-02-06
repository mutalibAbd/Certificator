/**
 * Editor Loading State
 *
 * Shown while the server component fetches template data.
 * Matches the EditorWorkspace layout skeleton.
 */

export default function EditorLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 animate-pulse">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-[var(--border)] shrink-0">
        <div className="h-4 w-20 bg-[var(--background-muted)] rounded" />
        <div className="flex items-center gap-3">
          <div className="h-4 w-32 bg-[var(--background-muted)] rounded" />
          <div className="h-5 w-16 bg-[var(--background-muted)] rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 bg-[var(--background-muted)] rounded-md" />
          <div className="h-8 w-24 bg-[var(--background-muted)] rounded-md" />
        </div>
      </div>

      {/* Body skeleton */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas area */}
        <div className="flex-[7] flex items-start justify-center p-6 bg-[var(--background-muted)]">
          <div className="w-full max-w-3xl">
            <div
              className="bg-white rounded-lg border border-[var(--canvas-border)]"
              style={{ aspectRatio: '210 / 297' }}
            />
          </div>
        </div>

        {/* Panel area */}
        <div className="flex-[3] min-w-[280px] max-w-[360px] bg-white border-l border-[var(--border)] p-4 space-y-4">
          <div className="h-4 w-16 bg-[var(--background-muted)] rounded" />
          <div className="space-y-2">
            <div className="h-10 bg-[var(--background-muted)] rounded-md" />
            <div className="h-10 bg-[var(--background-muted)] rounded-md" />
            <div className="h-10 bg-[var(--background-muted)] rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
