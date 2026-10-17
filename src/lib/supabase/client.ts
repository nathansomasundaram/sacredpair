import { createBrowserClient } from "@supabase/ssr";
import { publicEnv, supabaseCookieOptions } from "@/lib/env";
import type { Database } from "./database.types";

// Browser client: used for Realtime chat subscriptions and uploads.
// Row Level Security decides what it can read or write.
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: supabaseCookieOptions },
  );
}
