import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv, supabaseCookieOptions, supabaseServerUrl } from "@/lib/env";

// Refreshes the Supabase session cookie on each request so Server Components
// always see a valid session. Returns the user's id, or null when signed out.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseServerUrl(),
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims() verifies the token signature. Do not put code between
  // creating the client and this call.
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims?.sub ?? null;
  } catch {
    // Auth service unreachable (for example Supabase not started locally).
    // Treat as signed out rather than failing every page.
  }

  return { response, userId };
}
