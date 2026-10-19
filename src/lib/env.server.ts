import "server-only";
import { z } from "zod";

// Server-only secrets. Importing this file from a Client Component fails the build.
const serverSchema = z
  .object({
    SUPABASE_SECRET_KEY: z.string().min(1),
    // "stripe" in production. "simulated" lets you run the whole flow
    // locally without Stripe keys; it is refused on the production site.
    IDENTITY_PROVIDER: z.enum(["stripe", "simulated"]).default("simulated"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_IDENTITY_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.IDENTITY_PROVIDER === "stripe" && !env.STRIPE_SECRET_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["STRIPE_SECRET_KEY"],
        message: "STRIPE_SECRET_KEY is required when IDENTITY_PROVIDER=stripe",
      });
    }
    if (
      env.IDENTITY_PROVIDER === "simulated" &&
      process.env.VERCEL_ENV === "production"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["IDENTITY_PROVIDER"],
        message: "Test verification can't be used on the production site",
      });
    }
  });

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    IDENTITY_PROVIDER: process.env.IDENTITY_PROVIDER || undefined,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || undefined,
    STRIPE_IDENTITY_WEBHOOK_SECRET:
      process.env.STRIPE_IDENTITY_WEBHOOK_SECRET || undefined,
  });
  return cached;
}
