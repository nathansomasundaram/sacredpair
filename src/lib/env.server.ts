import "server-only";
import { z } from "zod";

// Server-only secrets. Importing this file from a Client Component fails the build.
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  return cached;
}
