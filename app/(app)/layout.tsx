import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ToastProvider } from '@/components/ToastProvider'
import { signOut } from './actions'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  // Middleware already verifies the JWT via getUser().
  // Here we only need the decoded session for the user email display.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="h-16 bg-white border-b border-[var(--border)] flex items-center justify-between px-6">
        {/* Left: App name */}
        <a
          href="/dashboard"
          className="text-lg font-semibold text-[var(--foreground)] no-underline"
        >
          Certificator
        </a>

        {/* Right: User email + Sign out */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--foreground-muted)]">
            {user.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition cursor-pointer"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {/* Main content area */}
      <main>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </main>
    </div>
  )
}
