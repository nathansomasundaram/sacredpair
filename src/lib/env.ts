import { z } from "zod";

// Public values are inlined into the browser bundle at build time, so they
// must be read with their full literal names.
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

// Inside Docker the server reaches Supabase through the host
// (host.docker.internal) while the browser still uses 127.0.0.1.
export function supabaseServerUrl() {
  return (
    process.env.SUPABASE_INTERNAL_URL || publicEnv.NEXT_PUBLIC_SUPABASE_URL
  );
}

// Fixed cookie name so a session set by the browser is recognised by the
// server even when the two reach Supabase through different hostnames.
export const supabaseCookieOptions = { name: "sb-sacredpair-auth-token" };
