import type Stripe from "stripe";

/** What a member's entitlements row should say for a Stripe subscription. */
export type StripeEntitlement = {
  tier: "free" | "premium";
  source: "stripe" | null;
  expires_at: string | null;
  renews: boolean;
  external_subscription_id: string | null;
};

/**
 * Statuses that keep Premium until the end of the paid period. "past_due"
 * is included: Stripe is still retrying the card, and the member keeps
 * Premium until it gives up (then the status becomes canceled or unpaid).
 */
const PAID = new Set(["active", "trialing", "past_due"]);

/** The end of the period already paid for (the latest across items). */
export function paidUntil(sub: Stripe.Subscription): Date | null {
  const ends = sub.items.data
    .map((item) => item.current_period_end)
    .filter((n): n is number => typeof n === "number");
  return ends.length ? new Date(Math.max(...ends) * 1000) : null;
}

/**
 * Premium while the subscription is paid, until the end of the paid
 * period; that is also when a cancelled subscription stops. Anything else
 * (canceled, unpaid, incomplete, paused) is a free membership.
 */
export function entitlementFromSubscription(
  sub: Stripe.Subscription,
): StripeEntitlement {
  const until = paidUntil(sub);
  if (!PAID.has(sub.status) || !until) {
    return {
      tier: "free",
      source: null,
      expires_at: null,
      renews: false,
      external_subscription_id: null,
    };
  }
  return {
    tier: "premium",
    source: "stripe",
    expires_at: until.toISOString(),
    renews: !sub.cancel_at_period_end && !sub.cancel_at,
    external_subscription_id: sub.id,
  };
}

/** The customer ID, whether Stripe expanded the customer or not. */
export function customerId(
  customer: string | { id: string } | null | undefined,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}
