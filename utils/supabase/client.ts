/**
 * Supabase Browser Client
 * 
 * Use this client in Client Components (files with 'use client' directive).
 * This client uses the public anon key and enforces RLS policies.
 * 
 * @example
 * ```tsx
 * 'use client';
 * import { createClient } from '@/utils/supabase/client';
 * 
 * export default function MyComponent() {
 *   const supabase = createClient();
 *   
 *   const fetchTemplates = async () => {
 *     const { data, error } = await supabase
 *       .from('templates')
 *       .select('*');
 *     // RLS ensures user only sees their own templates
 *   };
 * }
 * ```
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

/**
 * Create a Supabase client for browser/client-side usage
 * 
 * SECURITY:
 * - Uses public anon key (safe for client-side)
 * - RLS policies are enforced
 * - User session is managed via cookies
 * 
 * @returns Supabase client instance with Database types
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
