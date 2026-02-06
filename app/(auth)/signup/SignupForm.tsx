'use client';

import { useState } from 'react';
import { signup } from './actions';
import { SubmitButton } from '@/components/SubmitButton';
import Link from 'next/link';

/**
 * SignupForm
 *
 * Client component that renders the account registration form.
 * Performs client-side password confirmation and delegates
 * submission to the `signup` server action.
 */
export function SignupForm({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordError(null);
    // Remove confirmPassword before sending to server action
    formData.delete('confirmPassword');
    signup(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {success && (
        <div
          role="status"
          className="rounded-md border border-[var(--success)] bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {(error || passwordError) && (
        <div
          role="alert"
          className="rounded-md border border-[var(--error)] bg-red-50 px-4 py-3 text-sm text-[var(--error)]"
        >
          {passwordError || error}
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
          autoComplete="new-password"
          placeholder="Create a password"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--canvas-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--foreground-muted)] outline-none transition-colors focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-1"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Confirm your password"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--canvas-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--foreground-muted)] outline-none transition-colors focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-1"
        />
      </div>

      <SubmitButton label="Create Account" />

      <p className="text-center text-sm text-[var(--foreground-muted)]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
