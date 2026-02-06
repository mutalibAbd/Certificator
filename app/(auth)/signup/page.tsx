/**
 * Signup Page
 *
 * Server Component that renders the registration form.
 * Reads `error` and `success` search params to display feedback messages.
 */

import { SignupForm } from './SignupForm';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  return (
    <>
      <h2 className="mb-6 text-center text-xl font-semibold text-[var(--foreground)]">
        Create your account
      </h2>
      <SignupForm error={error} success={success} />
    </>
  );
}
