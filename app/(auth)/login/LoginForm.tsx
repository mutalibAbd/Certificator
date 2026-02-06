'use client';

import { login } from './actions';
import { SubmitButton } from '@/components/SubmitButton';
import Link from 'next/link';

/**
 * LoginForm
 *
 * Client component that renders the email/password login form.
 * Delegates submission to the `login` server action.
 * Displays an error message when provided via props.
 */
export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={login} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--error)] bg-red-50 px-4 py-3 text-sm text-[var(--error)]"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--canvas-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--foreground-muted)] outline-none transition-colors focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-1"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Enter your password"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--canvas-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--foreground-muted)] outline-none transition-colors focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-1"
        />
      </div>

      <SubmitButton label="Sign In" />

      <p className="text-center text-sm text-[var(--foreground-muted)]">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
