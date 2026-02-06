/**
 * Keep-Alive Pulse API Route
 * 
 * Purpose: Prevent Supabase from pausing the database after 7 days of inactivity.
 * 
 * HOW IT WORKS:
 * 1. External cron job (GitHub Actions) calls this endpoint every 48 hours
 * 2. Endpoint verifies CRON_SECRET header for security
 * 3. Executes a WRITE operation to system_health table
 * 4. Write operation forces WAL (Write-Ahead Log) commit, guaranteeing database activity
 * 
 * WHY A WRITE OPERATION:
 * - Simple SELECT queries might be cached by the database engine
 * - SELECT might be considered insufficient activity by Supabase
 * - UPDATE forces a transaction commit to the WAL
 * - This guarantees the database engine engages and records activity
 * 
 * SECURITY:
 * - Protected by CRON_SECRET header verification
 * - Uses service role key (bypasses RLS) to access system_health table
 * - system_health table has no public RLS policies (anon key = zero access)
 * 
 * @route POST /api/system/pulse
 * @header x-cron-secret - Must match CRON_SECRET environment variable
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

// Vercel Free Tier: 10s default, can extend to 60s
// Keep-alive should be fast, but we set a reasonable duration
export const maxDuration = 10;

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic';

/**
 * Health check response type
 */
interface PulseResponse {
  success: boolean;
  message: string;
  timestamp: string;
  lastPulse?: string;
}

/**
 * Error response type
 */
interface ErrorResponse {
  success: false;
  error: string;
  timestamp: string;
}

/**
 * POST /api/system/pulse
 * 
 * Executes a keep-alive write operation to prevent database pausing.
 * Must include valid CRON_SECRET in x-cron-secret header.
 */
export async function POST(
  request: Request
): Promise<NextResponse<PulseResponse | ErrorResponse>> {
  const timestamp = new Date().toISOString();

  try {
    // =========================================================================
    // STEP 1: Verify CRON_SECRET
    // =========================================================================
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    // Check if CRON_SECRET is configured
    if (!expectedSecret) {
      console.error('[PULSE] CRON_SECRET environment variable is not set');
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error',
          timestamp,
        },
        { status: 500 }
      );
    }

    // Verify the provided secret
    if (!cronSecret || cronSecret !== expectedSecret) {
      console.warn('[PULSE] Unauthorized access attempt');
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          timestamp,
        },
        { status: 401 }
      );
    }

    // =========================================================================
    // STEP 2: Execute Keep-Alive Write Operation
    // =========================================================================
    const supabase = createAdminClient();

    // Use a fixed UUID for the health record (created in migration)
    const healthRecordId = '00000000-0000-0000-0000-000000000001';

    // UPDATE operation forces WAL commit, guaranteeing database activity
    // Type assertion needed because the generic Database type inference
    // doesn't fully resolve through the Supabase client's type chain
    const updatePayload = {
      last_pulse: timestamp,
      status: 'healthy' as const,
    };
    const { data, error } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('system_health') as any)
      .update(updatePayload)
      .eq('id', healthRecordId)
      .select('last_pulse')
      .single();

    if (error) {
      console.error('[PULSE] Database write failed:', error.message);
      return NextResponse.json(
        {
          success: false,
          error: `Database error: ${error.message}`,
          timestamp,
        },
        { status: 500 }
      );
    }

    // =========================================================================
    // STEP 3: Return Success Response
    // =========================================================================
    console.log(`[PULSE] Keep-alive successful at ${timestamp}`);

    return NextResponse.json({
      success: true,
      message: 'Keep-alive pulse recorded successfully',
      timestamp,
      lastPulse: data?.last_pulse,
    });

  } catch (error) {
    // Defensive: Catch any unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PULSE] Unexpected error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        timestamp,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/system/pulse
 * 
 * Health check endpoint for monitoring (no authentication required).
 * Returns current system status without modifying the database.
 */
export async function GET(): Promise<NextResponse<PulseResponse | ErrorResponse>> {
  const timestamp = new Date().toISOString();

  try {
    const supabase = createAdminClient();
    const healthRecordId = '00000000-0000-0000-0000-000000000001';

    const { data, error } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('system_health') as any)
      .select('last_pulse, status')
      .eq('id', healthRecordId)
      .single() as { data: { last_pulse: string; status: string } | null; error: Error | null };

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Database error: ${error.message}`,
          timestamp,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `System status: ${data?.status || 'unknown'}`,
      timestamp,
      lastPulse: data?.last_pulse,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PULSE] GET error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        timestamp,
      },
      { status: 500 }
    );
  }
}
