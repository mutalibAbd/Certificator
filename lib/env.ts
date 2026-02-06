/**
 * Environment Variable Validation
 *
 * Centralizes all environment variable access with runtime validation.
 * Import accessor functions from this module instead of reading
 * `process.env` directly throughout the codebase.
 *
 * Required variables are documented in `.env.local.example`.
 */

/** All environment variables the application requires at runtime. */
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
] as const;

/**
 * Validate that every required environment variable is set.
 * Call once at application startup (e.g. in `next.config.ts` or a
 * top-level server module) to fail fast on misconfiguration.
 *
 * @throws {Error} If any required variable is missing or empty.
 */
export function validateEnv(): void {
  for (const name of REQUIRED_ENV_VARS) {
    if (!process.env[name]) {
      throw new Error(
        `Missing environment variable: ${name}. Check .env.local.example for setup instructions.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Typed accessor functions
// ---------------------------------------------------------------------------

/**
 * Return a validated environment variable or throw.
 * Keeps the per-accessor logic DRY.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. Check .env.local.example for setup instructions.`
    );
  }
  return value;
}

/**
 * Get the Supabase project URL.
 *
 * @returns The `NEXT_PUBLIC_SUPABASE_URL` value.
 * @throws {Error} If the variable is not set.
 */
export function getSupabaseUrl(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_URL');
}

/**
 * Get the Supabase anonymous (public) key.
 *
 * @returns The `NEXT_PUBLIC_SUPABASE_ANON_KEY` value.
 * @throws {Error} If the variable is not set.
 */
export function getSupabaseAnonKey(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * Get the Supabase service role key.
 *
 * WARNING: This key bypasses Row Level Security. Only use server-side.
 *
 * @returns The `SUPABASE_SERVICE_ROLE_KEY` value.
 * @throws {Error} If the variable is not set.
 */
export function getServiceRoleKey(): string {
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Get the cron / keep-alive secret used to authorize scheduled requests.
 *
 * @returns The `CRON_SECRET` value.
 * @throws {Error} If the variable is not set.
 */
export function getCronSecret(): string {
  return requireEnv('CRON_SECRET');
}
