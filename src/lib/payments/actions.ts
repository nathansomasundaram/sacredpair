"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/redirect";
import { requireVerifiedMember } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import {
  customerFor,
  ensureCustomer,
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
  const customer = await ensureCustomer(user.id, user.email ?? undefined);
  const session = await paymentsStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    metadata: { user_id: user.id },
    allow_promotion_codes: true,
    success_url: `${site}/upgrade/success?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(next)}`,
    cancel_url: `${site}/upgrade?next=${encodeURIComponent(next)}&canceled=1`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout link");
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
