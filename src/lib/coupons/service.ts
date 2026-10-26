import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import {
  appliesToCurrency,
  normalizeCode,
  type CouponDuration,
  type CouponError,
  type CouponTerms,
} from "./pricing";

type Row = {
  coupon_id: string | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  currency: string | null;
  duration: CouponDuration | null;
  duration_months: number | null;
  error: string | null;
};

export type CouponResult =
  | { ok: true; code: string; terms: CouponTerms }
  | { ok: false; code: string; error: CouponError };

function result(code: string, row: Row | undefined, currency?: string) {
  if (!row || row.error || !row.coupon_id || !row.duration) {
    return {
      ok: false,
      code,
      error: (row?.error as CouponError | null) ?? "not_found",
    } satisfies CouponResult;
  }
  const terms: CouponTerms = {
    couponId: row.coupon_id,
    percentOff: row.percent_off,
    amountOffCents: row.amount_off_cents,
    currency: row.currency ?? "usd",
    duration: row.duration,
    durationMonths: row.duration_months,
  };
  if (currency && !appliesToCurrency(currency, terms)) {
    return { ok: false, code, error: "currency" } satisfies CouponResult;
  }
  return { ok: true, code, terms } satisfies CouponResult;
}

/**
 * What a code would do for this member and plan. Holds nothing, so it's what
 * the upgrade screen uses to show the discounted price.
 */
export async function previewCoupon(
  rawCode: unknown,
  userId: string,
  plan: "monthly" | "yearly",
  currency?: string,
): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, code, error: "not_found" };
  const { data, error } = await createAdminClient().rpc("coupon_preview", {
    p_code: code,
    p_user: userId,
    p_plan: plan,
  });
  if (error) throw error;
  return result(code, (data as Row[] | null)?.[0], currency);
}

/**
 * A code staff plugged into this member that they can still use, so the
 * upgrade screen can offer it. Null when there's none.
 */
export async function assignedCouponCode(
  userId: string,
): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("coupon_members")
    .select("coupons(code, active, starts_at, expires_at)")
    .eq("user_id", userId);
  if (error) throw error;
  const now = Date.now();
  type Joined = {
    code: string;
    active: boolean;
    starts_at: string | null;
    expires_at: string | null;
  };
  const candidates = (data ?? [])
    .flatMap((r) => (r.coupons ? [r.coupons as unknown as Joined] : []))
    .filter(
      (c) =>
        c.active &&
        (!c.starts_at || new Date(c.starts_at).getTime() <= now) &&
        (!c.expires_at || new Date(c.expires_at).getTime() > now),
    );
  for (const { code } of candidates) {
    for (const plan of ["monthly", "yearly"] as const) {
      if ((await previewCoupon(code, userId, plan)).ok) return code;
    }
  }
  return null;
}

/**
 * Checks a code and holds it for the checkout being created, so a code with
 * a limit can't be used by more checkouts than it allows.
 */
export async function claimCoupon(
  rawCode: unknown,
  userId: string,
  plan: "monthly" | "yearly",
  currency?: string,
): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, code, error: "not_found" };
  const { data, error } = await createAdminClient().rpc("claim_coupon", {
    p_code: code,
    p_user: userId,
    p_plan: plan,
  });
  if (error) throw error;
  return result(code, (data as Row[] | null)?.[0], currency);
}

/** Remembers which Checkout session a held code belongs to. */
export async function attachCouponSession(
  couponId: string,
  userId: string,
  sessionId: string,
) {
  const { error } = await createAdminClient().rpc("coupon_attach_session", {
    p_coupon: couponId,
    p_user: userId,
    p_session: sessionId,
  });
  if (error) throw error;
}

/** Counts the code as used once Stripe confirms the payment. Safe to repeat. */
export async function completeCouponSession(sessionId: string) {
  const { error } = await createAdminClient().rpc("coupon_complete", {
    p_session: sessionId,
  });
  if (error) throw error;
}
