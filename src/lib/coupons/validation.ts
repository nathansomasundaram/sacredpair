import { z } from "zod";
import { COUPON_CODE, normalizeCode } from "./pricing";

const PLANS = ["monthly", "yearly"] as const;

/**
 * What it takes to make a coupon. The keys match the database columns, so a
 * parsed coupon can be inserted as it is. The admin form and the partner API
 * both use it.
 */
export const couponInputSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCode)
      .pipe(z.string().regex(COUPON_CODE)),
    description: z.string().trim().max(200).default(""),
    percent_off: z.number().int().min(1).max(100).nullable().default(null),
    amount_off_cents: z
      .number()
      .int()
      .min(1)
      .max(1_000_000)
      .nullable()
      .default(null),
    currency: z.string().length(3).toLowerCase().default("usd"),
    duration: z.enum(["once", "repeating", "forever"]).default("once"),
    duration_months: z.number().int().min(1).max(36).nullable().default(null),
    plans: z
      .array(z.enum(PLANS))
      .min(1)
      .default([...PLANS]),
    max_redemptions: z
      .number()
      .int()
      .min(1)
      .max(1_000_000)
      .nullable()
      .default(null),
    starts_at: z.iso.datetime({ offset: true }).nullable().default(null),
    expires_at: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .superRefine((c, ctx) => {
    if ((c.percent_off === null) === (c.amount_off_cents === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["percent_off"],
        message: "percent_or_amount",
      });
    }
    if ((c.duration === "repeating") !== (c.duration_months !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["duration_months"],
        message: "months_when_repeating",
      });
    }
    if (c.starts_at && c.expires_at && c.expires_at <= c.starts_at) {
      ctx.addIssue({
        code: "custom",
        path: ["expires_at"],
        message: "ends_before_start",
      });
    }
  });

export type CouponInput = z.infer<typeof couponInputSchema>;

/** The first problem with a coupon, as a code the admin screen has wording for. */
export function firstProblem(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "invalid";
  if (issue.code === "custom") return issue.message;
  return String(issue.path[0] ?? "invalid");
}

/** Dollars typed as "5" or "5.50" to cents, or null when it isn't an amount. */
export function dollarsToCents(raw: string): number | null {
  const m = /^\d{1,7}(\.\d{1,2})?$/.exec(raw.trim());
  return m ? Math.round(Number(raw) * 100) : null;
}

/** A date typed as 2026-12-31 to the start (or end) of that day, UTC. */
export function dayToIso(raw: string, end = false): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())
    ? `${raw.trim()}T${end ? "23:59:59" : "00:00:00"}Z`
    : null;
}

export type PartnerLimits = { max_percent_off: number };

/**
 * Partners may make percentage discounts only, up to their own cap, that
 * can be used a limited number of times (once unless they ask for more).
 * Returns why a coupon isn't allowed, or null.
 */
export function partnerViolation(
  coupon: CouponInput,
  partner: PartnerLimits,
): "percent_only" | "percent_too_high" | null {
  if (coupon.percent_off === null) return "percent_only";
  if (coupon.percent_off > partner.max_percent_off) return "percent_too_high";
  return null;
}
