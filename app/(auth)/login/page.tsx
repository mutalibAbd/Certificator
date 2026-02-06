/**
 * Login Page
 *
 * Server Component that renders the login form.
 * Reads the `error` search param to display authentication errors.
 */

import { LoginForm } from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <h2 className="mb-6 text-center text-xl font-semibold text-[var(--foreground)]">
        Sign in to your account
      </h2>
      <LoginForm error={error} />
    </>
  );
}
