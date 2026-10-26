import type Stripe from "stripe";
import { completeCouponSession } from "@/lib/coupons/service";
import { serverEnv } from "@/lib/env.server";
import { stripeClient } from "@/lib/identity/stripe";
import { syncSubscription } from "@/lib/payments/stripe";
import { customerId } from "@/lib/payments/subscription";

/**
 * Stripe calls this when a Premium subscription changes: a new payment, a
 * renewal, a cancellation, a failed card. Add the endpoint in the Stripe
 * dashboard (Developers > Webhooks) at https://<your site>/api/webhooks/stripe
 * with the events below, and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */
const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripeClient(env.STRIPE_SECRET_KEY).webhooks.constructEvent(
      body,
      signature ?? "",
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({ error: "bad signature" }, { status: 400 });
  }

  let subscriptionId: string | null = null;
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  } else if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "subscription") {
      subscriptionId = customerId(session.subscription);
      // A paid checkout turns the held coupon code into a redemption.
      if (session.metadata?.coupon_id && session.payment_status !== "unpaid") {
        try {
          await completeCouponSession(session.id);
        } catch (error) {
          console.error("Couldn't record a coupon redemption", error);
          return Response.json({ error: "processing failed" }, { status: 500 });
        }
      }
    }
  } else if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object as Stripe.Invoice;
    const parent = invoice.parent?.subscription_details?.subscription;
    subscriptionId = customerId(parent);
  }

  if (subscriptionId) {
    try {
      await syncSubscription(subscriptionId);
    } catch (error) {
      if ((error as { message?: string })?.message === "unknown_subscription") {
        // Not one of ours (for example made in the Stripe dashboard).
        return Response.json({ received: true, ignored: true });
      }
      console.error("Stripe payments webhook failed", event.type, error);
      // Stripe retries on errors.
      return Response.json({ error: "processing failed" }, { status: 500 });
    }
  }
  return Response.json({ received: true });
}
