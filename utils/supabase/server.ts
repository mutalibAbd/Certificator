/**
 * Supabase Server Client
 * 
 * Use this client in Server Components, Server Actions, and API Routes.
 * This client handles cookie-based authentication for proper RLS enforcement.
 * 
 * CRITICAL: This is essential for Server Actions to function securely
 * within the Next.js App Router context. The cookie handling ensures
 * that the authenticated user's session is properly passed to Supabase.
 * 
 * @example Server Component
 * ```tsx
 * import { createClient } from '@/utils/supabase/server';
 * 
 * export default async function TemplatesPage() {
 *   const supabase = await createClient();
 *   const { data: templates } = await supabase
 *     .from('templates')
 *     .select('*');
 *   // RLS ensures user only sees their own templates
 * }
 * ```
 * 
 * @example Server Action
 * ```tsx
 * 'use server';
 * import { createClient } from '@/utils/supabase/server';
 * 
 * export async function createTemplate(formData: FormData) {
 *   const supabase = await createClient();
 *   const { data, error } = await supabase
 *     .from('templates')
 *     .insert({ ... });
 * }
 * ```
 * 
 * @example API Route
 * ```tsx
 * import { createClient } from '@/utils/supabase/server';
 * 
 * export async function GET() {
 *   const supabase = await createClient();
 *   // ...
 * }
 * ```
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

/**
 * Create a Supabase client for server-side usage with cookie-based auth
 * 
 * SECURITY:
 * - Uses public anon key with user session from cookies
 * - RLS policies are enforced based on authenticated user
 * - Cookies are read-only in Server Components, writable in Server Actions/Routes
 * 
 * IMPORTANT: This function must be called inside an async context
 * because it accesses the Next.js cookies() API.
 * 
 * @returns Promise<SupabaseClient> - Supabase client instance with Database types
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      /**
       * Get all cookies for Supabase auth
       * Used to restore user session on server-side
       */
      getAll() {
        return cookieStore.getAll();
      },
      /**
       * Set cookies for Supabase auth
       * Used to persist user session changes (login, logout, refresh)
       * 
       * Note: This may throw in Server Components (read-only context)
       * but will work in Server Actions and API Routes
       */
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions, which is the recommended approach.
        }
      },
    },
  });
}

/**
 * Create a Supabase admin client with service role key
 *
 * @deprecated Use `createAdminClient` from `@/lib/supabase-admin` instead.
 * This re-export ensures backward compatibility but points to the securely implemented version.
 */
export { createAdminClient } from '@/lib/supabase-admin';
