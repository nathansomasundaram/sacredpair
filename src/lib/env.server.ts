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
    // Text messages: "twilio" sends real texts; "simulated" only logs them
    // (local and previews); "none" turns texting off. Defaults to simulated,
    // or none on the production site.
    SMS_PROVIDER: z
      .enum(["twilio", "simulated", "none"])
      .default(process.env.VERCEL_ENV === "production" ? "none" : "simulated"),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),
    // Email notifications go out over SMTP (Resend, Postmark, SES and others
    // all offer it). Locally they go to Supabase's Mailpit inbox.
    SMTP_URL: z
      .string()
      .optional()
      .default(
        process.env.VERCEL_ENV === "production" ? "" : "smtp://127.0.0.1:54325",
      ),
    EMAIL_FROM: z.string().default("Sacred Pair <hello@sacredpair.com>"),
    // Web push: generate a pair with `npm run push:keys`.
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().default("mailto:hello@sacredpair.com"),
    // How members upgrade to Premium. "stripe" takes real payments (Stripe
    // Checkout, with test-mode keys on previews); "simulated" gives a free
    // 30-day test Premium (local and previews only); "none" shows that
    // Premium opens soon. Defaults to simulated, or none on production.
    PAYMENTS_PROVIDER: z
      .enum(["stripe", "simulated", "none"])
      .default(process.env.VERCEL_ENV === "production" ? "none" : "simulated"),
    // Stripe Price IDs (price_...) for the Premium plans. Monthly is
    // required for Stripe payments; yearly is offered when set.
    STRIPE_PRICE_MONTHLY: z.string().startsWith("price_").optional(),
    STRIPE_PRICE_YEARLY: z.string().startsWith("price_").optional(),
    // Signing secret of the payments webhook endpoint (/api/webhooks/stripe).
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
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
    if (
      env.SMS_PROVIDER === "twilio" &&
      !(
        env.TWILIO_ACCOUNT_SID &&
        env.TWILIO_AUTH_TOKEN &&
        env.TWILIO_FROM_NUMBER
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["SMS_PROVIDER"],
        message:
          "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER are required for SMS_PROVIDER=twilio",
      });
    }
    if (
      env.SMS_PROVIDER === "simulated" &&
      process.env.VERCEL_ENV === "production"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["SMS_PROVIDER"],
        message: "Simulated texts can't be used on the production site",
      });
    }
    if (
      env.PAYMENTS_PROVIDER === "stripe" &&
      !(
        env.STRIPE_SECRET_KEY &&
        env.STRIPE_PRICE_MONTHLY &&
        env.STRIPE_WEBHOOK_SECRET
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["PAYMENTS_PROVIDER"],
        message:
          "STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY and STRIPE_WEBHOOK_SECRET are required for PAYMENTS_PROVIDER=stripe",
      });
    }
    if (
      env.PAYMENTS_PROVIDER === "simulated" &&
      process.env.VERCEL_ENV === "production"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["PAYMENTS_PROVIDER"],
        message: "Test Premium can't be used on the production site",
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
    PAYMENTS_PROVIDER: process.env.PAYMENTS_PROVIDER || undefined,
    STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY || undefined,
    STRIPE_PRICE_YEARLY: process.env.STRIPE_PRICE_YEARLY || undefined,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || undefined,
    SMS_PROVIDER: process.env.SMS_PROVIDER || undefined,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || undefined,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || undefined,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || undefined,
    SMTP_URL: process.env.SMTP_URL ?? undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || undefined,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT || undefined,
  });
  return cached;
}
