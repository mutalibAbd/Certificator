'use client';

import { useFormStatus } from 'react-dom';

/**
 * SubmitButton
 *
 * A form submit button that displays a loading spinner during form submission.
 * Must be rendered inside a <form> element to access form status via useFormStatus.
 */
export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="loading-spinner mr-2 inline-block h-4 w-4" />
          Processing...
        </>
      ) : (
        label
      )}
    </button>
  );
}
