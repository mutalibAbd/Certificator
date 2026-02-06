'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Server Action: Login
 *
 * Authenticates a user with email and password via Supabase Auth.
 * Redirects to /dashboard on success, or back to /login with an error message.
 */
export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message));
  }

  redirect('/dashboard');
}
