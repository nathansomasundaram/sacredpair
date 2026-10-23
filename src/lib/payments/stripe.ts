import "server-only";
import type Stripe from "stripe";
import { serverEnv } from "@/lib/env.server";
import { stripeClient } from "@/lib/identity/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { customerId, entitlementFromSubscription } from "./subscription";

export type PlanKey = "monthly" | "yearly";

export type Plan = {
  key: PlanKey;
  priceId: string;
  /** In the smallest unit, for example cents. */
  amount: number;
  currency: string;
};

export function paymentsStripe() {
  const env = serverEnv();
  if (env.PAYMENTS_PROVIDER !== "stripe" || !env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe payments aren't configured");
  }
  return stripeClient(env.STRIPE_SECRET_KEY);
}

export function priceIdFor(key: PlanKey): string | undefined {
  const env = serverEnv();
  return key === "monthly" ? env.STRIPE_PRICE_MONTHLY : env.STRIPE_PRICE_YEARLY;
}

let plansCache: { at: number; plans: Plan[] } | undefined;

/**
 * The Premium plans with their prices, read from Stripe so the amount is
 * set in one place (the Stripe dashboard). Kept for ten minutes.
 */
export async function getPlans(): Promise<Plan[]> {
  if (plansCache && Date.now() - plansCache.at < 10 * 60 * 1000) {
    return plansCache.plans;
  }
  const stripe = paymentsStripe();
  const plans: Plan[] = [];
  for (const key of ["monthly", "yearly"] as const) {
    const id = priceIdFor(key);
    if (!id) continue;
    const price = await stripe.prices.retrieve(id);
    if (!price.active || price.unit_amount === null) continue;
    plans.push({
      key,
      priceId: price.id,
      amount: price.unit_amount,
      currency: price.currency,
    });
  }
  plansCache = { at: Date.now(), plans };
  return plans;
}

type EntitlementRow = {
  user_id: string;
  tier: string;
  source: string | null;
  external_customer_id: string | null;
  external_subscription_id: string | null;
};

async function entitlementOf(userId: string): Promise<EntitlementRow | null> {
  const { data, error } = await createAdminClient()
    .from("entitlements")
    .select(
      "user_id, tier, source, external_customer_id, external_subscription_id",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as EntitlementRow | null;
}

/** The member's Stripe customer, created the first time they subscribe. */
export async function ensureCustomer(
  userId: string,
  email: string | undefined,
): Promise<string> {
  const row = await entitlementOf(userId);
  if (row?.external_customer_id) return row.external_customer_id;
  const customer = await paymentsStripe().customers.create(
    { email, metadata: { user_id: userId } },
    // The same request twice (a double click) makes one customer.
    { idempotencyKey: `customer-${userId}` },
  );
  const { error } = await createAdminClient()
    .from("entitlements")
    .update({ external_customer_id: customer.id })
    .eq("user_id", userId);
  if (error) throw error;
  return customer.id;
}

/** The member's Stripe customer, if they have one. */
export async function customerFor(userId: string): Promise<string | null> {
  return (await entitlementOf(userId))?.external_customer_id ?? null;
}

/** Whether the member already pays for Premium through Stripe. */
export async function hasStripeSubscription(userId: string): Promise<boolean> {
  const row = await entitlementOf(userId);
  return row?.source === "stripe" && row.tier === "premium";
}

/**
 * Brings the member's Premium in line with a subscription, fetched fresh
 * from Stripe (never trusting an event body). Finds the member by the
 * user_id saved on the subscription, or by their customer. Safe to call
 * any number of times for the same subscription.
 */
export async function syncSubscription(subscriptionId: string): Promise<void> {
  const sub = await paymentsStripe().subscriptions.retrieve(subscriptionId);
  const admin = createAdminClient();

  let userId = sub.metadata?.user_id || null;
  const customer = customerId(sub.customer);
  if (!userId && customer) {
    const { data } = await admin
      .from("entitlements")
      .select("user_id")
      .eq("external_customer_id", customer)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) throw new Error("unknown_subscription");

  const current = await entitlementOf(userId);
  if (!current) throw new Error("unknown_subscription");
  const next = entitlementFromSubscription(sub);

  // An old subscription ending mustn't cancel a newer one that's paid.
  if (
    next.tier === "free" &&
    current.external_subscription_id &&
    current.external_subscription_id !== sub.id
  ) {
    return;
  }
  // Leave Premium from somewhere else (the app stores, a manual grant)
  // alone when a Stripe subscription isn't paying.
  if (next.tier === "free" && current.source && current.source !== "stripe") {
    return;
  }

  const { error } = await admin
    .from("entitlements")
    .update({
      ...next,
      external_customer_id: customer ?? current.external_customer_id,
    })
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Cancels the member's Stripe subscription straight away. Used when an
 * account is deleted, so nobody is charged for an account that's gone.
 */
export async function cancelSubscriptionNow(userId: string): Promise<void> {
  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY) return;
  const row = await entitlementOf(userId);
  if (!row?.external_subscription_id) return;
  const stripe = stripeClient(env.STRIPE_SECRET_KEY);
  try {
    await stripe.subscriptions.cancel(row.external_subscription_id);
  } catch (e) {
    const code = (e as Stripe.errors.StripeError)?.code;
    // Already gone is fine.
    if (code !== "resource_missing") throw e;
  }
}
