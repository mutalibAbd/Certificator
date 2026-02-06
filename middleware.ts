/**
 * Next.js Middleware — Supabase Auth Session Refresh & Route Protection
 *
 * This middleware runs on every matched request and serves two purposes:
 *
 * 1. SESSION REFRESH: Uses the Supabase server client to read and refresh
 *    the auth cookie on every request. This keeps the user's session alive
 *    without requiring a full page reload. The cookie bridge pattern below
 *    ensures updated tokens are forwarded both to the origin server and
 *    back to the browser.
 *
 * 2. ROUTE PROTECTION:
 *    - Protected routes (/dashboard, /editor, /api except /api/system/pulse)
 *      redirect unauthenticated visitors to /login.
 *    - Auth routes (/login, /signup) redirect already-authenticated users
 *      to /dashboard so they don't see forms they no longer need.
 *
 * IMPORTANT:
 * - Uses supabase.auth.getUser() (server-verified) instead of getSession()
 *   which only reads the JWT and can be spoofed.
 * - The cookie bridge writes to both request.cookies (forwarded request)
 *   and supabaseResponse.cookies (returned to the browser).
 * - This file MUST live at the project root (next to package.json).
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

/** Routes that require an authenticated user. */
const PROTECTED_PREFIXES = ['/dashboard', '/editor', '/api'] as const;

/** API routes that are explicitly public (no auth required). */
const PUBLIC_API_ROUTES = ['/api/system/pulse'] as const;

/** Auth pages — authenticated users should be redirected away from these. */
const AUTH_PATHS = ['/login', '/signup'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether the given pathname is a protected route.
 *
 * A route is protected when it starts with one of the PROTECTED_PREFIXES
 * **and** is not listed in PUBLIC_API_ROUTES (e.g. the health-check pulse).
 */
function isProtectedRoute(pathname: string): boolean {
  const matchesProtectedPrefix = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!matchesProtectedPrefix) return false;

  // Allow explicitly public API routes through without auth
  const isPublicException = PUBLIC_API_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  return !isPublicException;
}

/**
 * Determine whether the given pathname is an auth page (/login, /signup).
 * Authenticated users will be redirected away from these.
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  // Start with a pass-through response. We will attach updated auth cookies
  // to this response before returning it.
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // --- Fast path: skip auth entirely for public pages ---------------------
  // No need to call getUser() for routes that don't require auth, saving
  // a network round-trip to Supabase Auth (~100-500ms).
  const isPublic =
    pathname === '/' ||
    isAuthRoute(pathname) ||
    PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));

  if (isPublic && !request.cookies.get('sb-access-token')?.value) {
    // No session cookie at all — definitely not logged in, skip auth.
    return supabaseResponse;
  }

  // --- Environment variable guard ----------------------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // In development you'll see this in the terminal; in production this
    // should never happen because env vars are validated at build time.
    console.error(
      '[middleware] Missing Supabase environment variables. ' +
        'Auth session refresh and route protection are DISABLED.',
    );
    return supabaseResponse;
  }

  // --- Create a Supabase server client with the cookie bridge ------------
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write each cookie to two places:
        // 1. The forwarded request object (so the origin server sees fresh tokens)
        // 2. The response object (so the browser stores the refreshed tokens)
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });

        // Re-create the response so the updated request cookies are forwarded.
        supabaseResponse = NextResponse.next({ request });

        // Re-apply cookie values to the new response (browser needs them).
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // --- Refresh the session -----------------------------------------------
  // IMPORTANT: getUser() makes a server-side call to Supabase Auth to verify
  // the JWT. Do NOT replace this with getSession() — getSession only decodes
  // the token locally and is not tamper-proof.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Route protection --------------------------------------------------

  // 1. Protected routes: redirect unauthenticated users to /login
  if (!user && isProtectedRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    // Preserve the originally requested URL so the login page can redirect
    // back after successful authentication.
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Auth routes: redirect authenticated users to /dashboard
  if (user && isAuthRoute(pathname)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  // --- Pass through with refreshed cookies --------------------------------
  return supabaseResponse;
}

// ---------------------------------------------------------------------------
// Matcher configuration
// ---------------------------------------------------------------------------

/**
 * Run middleware on all routes EXCEPT:
 * - _next/static  (Next.js static assets)
 * - _next/image   (Next.js image optimization)
 * - favicon.ico   (browser favicon)
 * - Common image/font file extensions served from /public
 *
 * This keeps middleware out of the hot path for static assets and reduces
 * cold-start overhead on every asset request (zero-cost philosophy).
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};
