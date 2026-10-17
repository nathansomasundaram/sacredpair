import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, supabaseCookieOptions, supabaseServerUrl } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

// Acts as the signed-in user. Row Level Security applies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseServerUrl(),
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session on the next request instead.
          }
        },
      },
    },
  );
}

// Bypasses Row Level Security. Only for trusted server work such as payment
// webhooks, scheduled jobs and moderation. Never pass its results to the
// browser without filtering.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    supabaseServerUrl(),
    serverEnv().SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
