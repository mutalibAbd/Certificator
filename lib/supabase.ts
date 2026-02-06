/**
 * Supabase Client Utilities
 * 
 * This file provides type-safe Supabase client instances for:
 * - Client Components (browser-side)
 * - Server Components (server-side)
 * - Server Actions and API Routes (server-side with service role)
 * 
 * SECURITY:
 * - Browser clients use the public anon key (RLS enforced)
 * - Server clients can use service role for admin operations
 */

import { createBrowserClient } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

/**
 * Get Supabase URL from environment
 * Throws error if not configured
 */
function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not defined. Check your .env.local file.'
    );
  }
  return url;
}

/**
 * Get Supabase Anon Key from environment
 * Throws error if not configured
 */
function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. Check your .env.local file.'
    );
  }
  return key;
}

/**
 * Get Supabase Service Role Key from environment
 * Only use server-side for admin operations
 * WARNING: This key bypasses RLS. Use with extreme caution.
 */
function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not defined. Check your .env.local file.'
    );
  }
  return key;
}

// ============================================================================
// BROWSER CLIENT (Client Components)
// ============================================================================

/**
 * Create a Supabase client for Client Components
 * 
 * Usage:
 * ```tsx
 * 'use client';
 * import { createClient } from '@/lib/supabase';
 * 
 * export default function MyComponent() {
 *   const supabase = createClient();
 *   // Use supabase client...
 * }
 * ```
 * 
 * SECURITY: Uses anon key with RLS enforced
 */
export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey()
  );
}

// ============================================================================
// SERVER CLIENT (Server Components, API Routes, Server Actions)
// ============================================================================

/**
 * Cookie store type for server-side Supabase client
 */
export interface CookieStore {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: Record<string, unknown>): void;
}

/**
 * Create a Supabase client for Server Components
 * Handles cookies for authentication
 * 
 * Usage in Server Components:
 * ```tsx
 * import { createServerSupabaseClient } from '@/lib/supabase';
 * import { cookies } from 'next/headers';
 * 
 * export default async function MyPage() {
 *   const supabase = await createServerSupabaseClient();
 *   // Use supabase client...
 * }
 * ```
 * 
 * Usage in API Routes:
 * ```tsx
 * import { createServerSupabaseClient } from '@/lib/supabase';
 * 
 * export async function GET() {
 *   const supabase = await createServerSupabaseClient();
 *   // Use supabase client...
 * }
 * ```
 * 
 * SECURITY: Uses anon key with RLS enforced
 */
export async function createServerSupabaseClient() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  
  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Handle cookie errors in middleware/edge runtime
            console.error('Error setting cookies:', error);
          }
        },
      },
    }
  );
}

// ============================================================================
// ADMIN CLIENT (Server-side only - Service Role)
// ============================================================================

/**
 * Create a Supabase admin client with service role key
 * 
 * WARNING: This client bypasses Row Level Security (RLS)
 * Only use for:
 * - Keep-alive health checks (system_health table)
 * - Admin operations that require elevated privileges
 * - Never expose to client-side code
 * 
 * Usage in API Routes:
 * ```tsx
 * import { createAdminClient } from '@/lib/supabase';
 * 
 * export async function POST(request: Request) {
 *   const adminClient = createAdminClient();
 *   // Update system_health table...
 * }
 * ```
 * 
 * SECURITY: Bypasses RLS - use with extreme caution
 */
export function createAdminClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey()
  );
}
