'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Server Action: Signup
 *
 * Creates a new user account with email and password via Supabase Auth.
 * Redirects back to /signup with a success message prompting email confirmation,
 * or with an error message if registration fails.
 */
export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message));
  }

  redirect('/signup?success=Check your email to confirm your account');
}
