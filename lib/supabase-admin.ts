'use server';

/**
 * Supabase Admin Client
 *
 * Provides a privileged Supabase client with SERVICE ROLE access.
 *
 * SECURITY CRITICAL:
 * - This module MUST be server-side only ('use server' directive enforced).
 * - The client created here BYPASSES all Row Level Security (RLS).
 * - Never expose the service role key to the client.
 * - Use only for administrative tasks, background jobs, or system operations.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Create a Supabase admin client with service role key
 *
 * WARNING: This client BYPASSES Row Level Security (RLS)!
 *
 * Usage scenarios:
 * - Keep-alive health checks (system_health table)
 * - Admin operations requiring elevated privileges
 * - Background jobs without user context
 *
 * forbidden scenarios:
 * - In response to user input without strict validation
 * - In Client Components (strictly prohibited)
 * - For operations that should respect user permissions
 *
 * @returns SupabaseClient with service role privileges
 * @throws Error if environment variables are missing
 */
export async function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
    }

    if (!supabaseServiceKey) {
        throw new Error(
            'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
            'This key is required for admin operations.'
        );
    }

    // Use standard Supabase client for service role operations
    // Service role bypasses RLS, so no user session/cookies needed
    return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
