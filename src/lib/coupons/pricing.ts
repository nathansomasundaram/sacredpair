/** What a coupon does to a price. No server code here, so pages and tests can share it. */

export type CouponDuration = "once" | "repeating" | "forever";

export type CouponTerms = {
  couponId: string;
  percentOff: number | null;
  /** In the smallest unit of `currency`, for example cents. */
  amountOffCents: number | null;
  currency: string;
  duration: CouponDuration;
  durationMonths: number | null;
};

/** Why a code can't be used. Each has wording under upgrade.coupon.errors. */
export type CouponError =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "wrong_plan"
  | "already_used"
  | "exhausted"
  | "currency";

export const COUPON_CODE = /^[A-Z0-9][A-Z0-9_-]{3,31}$/;

/** What a member types, in the one form codes are stored: trimmed and upper case. */
export function normalizeCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase().slice(0, 40) : "";
}

/**
 * The price after the coupon, in the smallest unit. Percentages round to the
 * nearest unit, as Stripe does; an amount off never goes below zero. An
 * amount in another currency than the price doesn't apply.
 */
export function discountedAmount(
  amount: number,
  currency: string,
  terms: Pick<CouponTerms, "percentOff" | "amountOffCents" | "currency">,
): number {
  if (terms.percentOff !== null) {
    return Math.round((amount * (100 - terms.percentOff)) / 100);
  }
  if (
    terms.amountOffCents !== null &&
    terms.currency.toLowerCase() === currency.toLowerCase()
  ) {
    return Math.max(0, amount - terms.amountOffCents);
  }
  return amount;
}

export type CouponState = "off" | "scheduled" | "expired" | "used_up" | "live";

/** Where a coupon stands today, for the admin lists. */
export function couponState(
  c: {
    active: boolean;
    startsAt: string | null;
    expiresAt: string | null;
    maxRedemptions: number | null;
    redeemed: number;
  },
  now: Date = new Date(),
): CouponState {
  if (!c.active) return "off";
  if (c.expiresAt && new Date(c.expiresAt) <= now) return "expired";
  if (c.startsAt && new Date(c.startsAt) > now) return "scheduled";
  if (c.maxRedemptions !== null && c.redeemed >= c.maxRedemptions) {
    return "used_up";
  }
  return "live";
}

/** Whether the coupon can take money off a price in this currency. */
export function appliesToCurrency(
  currency: string,
  terms: Pick<CouponTerms, "percentOff" | "currency">,
): boolean {
  return (
    terms.percentOff !== null ||
    terms.currency.toLowerCase() === currency.toLowerCase()
  );
}
