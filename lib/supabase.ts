/**
 * Supabase Client Utilities - Re-exports
 *
 * This file re-exports Supabase clients from the canonical location.
 * All implementations are in @/utils/supabase/*.
 *
 * For new code, import directly from:
 * - '@/utils/supabase/client' for browser clients
 * - '@/utils/supabase/server' for server clients
 *
 * This file exists for backwards compatibility and migration purposes.
 *
 * @deprecated Use @/utils/supabase/* directly
 */

// Browser client (for Client Components)
export { createClient } from '@/utils/supabase/client';

// Server clients (for Server Components, API Routes, Server Actions)
export { createClient as createServerSupabaseClient, createAdminClient } from '@/utils/supabase/server';
