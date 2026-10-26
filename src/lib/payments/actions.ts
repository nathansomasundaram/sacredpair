"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { safeNext } from "@/lib/auth/redirect";
import { requireVerifiedMember } from "@/lib/auth/session";
import { normalizeCode } from "@/lib/coupons/pricing";
import { attachCouponSession, claimCoupon } from "@/lib/coupons/service";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import {
  customerFor,
  ensureCustomer,
  getPlans,
  hasStripeSubscription,
  paymentsStripe,
  priceIdFor,
} from "./stripe";

/**
 * Starts a Premium subscription: sends the member to Stripe Checkout for
 * the chosen plan. Stripe brings them back to /upgrade/success, which
 * turns on Premium as soon as the payment is confirmed (the webhook does
 * the same, so a closed tab doesn't matter).
 */
export async function startCheckout(formData: FormData) {
  const user = await requireVerifiedMember("/upgrade");
  if (serverEnv().PAYMENTS_PROVIDER !== "stripe") redirect("/upgrade");
  const next = safeNext(formData.get("next"), "/details");
  const plan = formData.get("plan") === "yearly" ? "yearly" : "monthly";
  const price = priceIdFor(plan);
  if (!price) redirect(`/upgrade?next=${encodeURIComponent(next)}`);

  // Already paying: manage the existing subscription instead of a second.
  if (await hasStripeSubscription(user.id)) {
    redirect("/settings/membership");
  }

  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  const stripe = paymentsStripe();

  // A coupon code is checked again here and held for this checkout, so the
  // discount can't be claimed by a forged form field or used past its limit.
  const code = normalizeCode(formData.get("coupon"));
  let discount: Stripe.Checkout.SessionCreateParams["discounts"];
  let held: { couponId: string } | null = null;
  if (code) {
    const currency = (await getPlans()).find((p) => p.key === plan)?.currency;
    const claim = await claimCoupon(code, user.id, plan, currency);
    if (!claim.ok) {
      redirect(
        `/upgrade?next=${encodeURIComponent(next)}&coupon=${encodeURIComponent(code)}`,
      );
    }
    const { terms } = claim;
    const coupon = await stripe.coupons.create(
      {
        name: code,
        ...(terms.percentOff !== null
          ? { percent_off: terms.percentOff }
          : { amount_off: terms.amountOffCents!, currency: terms.currency }),
        duration: terms.duration,
        ...(terms.duration === "repeating"
          ? { duration_in_months: terms.durationMonths! }
          : {}),
        max_redemptions: 1,
        metadata: { coupon_id: terms.couponId, user_id: user.id },
      },
      // The same checkout twice (a double click) makes one Stripe coupon.
      { idempotencyKey: `coupon-${terms.couponId}-${user.id}-${plan}` },
    );
    discount = [{ coupon: coupon.id }];
    held = { couponId: terms.couponId };
  }

  const customer = await ensureCustomer(user.id, user.email ?? undefined);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    metadata: {
      user_id: user.id,
      ...(held ? { coupon_id: held.couponId } : {}),
    },
    // Stripe allows either a discount we applied or a code typed at checkout.
    ...(discount
      ? {
          discounts: discount,
          // Matches the 35-minute hold on the code (Stripe's minimum is 30).
          expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
        }
      : { allow_promotion_codes: true }),
    success_url: `${site}/upgrade/success?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(next)}`,
    cancel_url: `${site}/upgrade?next=${encodeURIComponent(next)}&canceled=1`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout link");
  if (held) await attachCouponSession(held.couponId, user.id, session.id);
  redirect(session.url);
}

/**
 * Opens Stripe's customer portal, where the member changes their card,
 * switches plan, downloads receipts or cancels.
 */
export async function openBillingPortal() {
  const user = await requireVerifiedMember("/settings/membership");
  if (serverEnv().PAYMENTS_PROVIDER !== "stripe") {
    redirect("/settings/membership");
  }
  const customer = await customerFor(user.id);
  if (!customer) redirect("/upgrade?next=/settings/membership");
  const session = await paymentsStripe().billingPortal.sessions.create({
    customer,
    return_url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/settings/membership`,
  });
  redirect(session.url);
}
