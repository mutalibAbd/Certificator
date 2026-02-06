/**
 * Supabase Client Exports
 * 
 * This module re-exports the Supabase clients for convenient importing.
 * 
 * USAGE GUIDE:
 * 
 * 1. CLIENT COMPONENTS ('use client' directive):
 *    ```tsx
 *    import { createClient } from '@/utils/supabase/client';
 *    ```
 * 
 * 2. SERVER COMPONENTS / SERVER ACTIONS / API ROUTES:
 *    ```tsx
 *    import { createClient } from '@/utils/supabase/server';
 *    ```
 * 
 * 3. ADMIN OPERATIONS (service role, bypasses RLS):
 *    ```tsx
 *    import { createAdminClient } from '@/utils/supabase/server';
 *    ```
 * 
 * IMPORTANT: Do NOT import server utilities in client components!
 * The server module uses Node.js APIs that don't work in the browser.
 */

// Note: We don't re-export here to avoid importing server code in client bundles.
// Import directly from the specific module you need:
// - '@/utils/supabase/client' for client components
// - '@/utils/supabase/server' for server components/actions/routes
