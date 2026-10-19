// Defaults match a local `npx supabase start` (see .env.example).
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ??
  "";
// Local inbox (Mailpit) that catches every email Supabase sends.
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
