import type Stripe from "stripe";
import { serverEnv } from "@/lib/env.server";
import { syncVerification } from "@/lib/identity/service";
import { stripeClient } from "@/lib/identity/stripe";

/**
 * Stripe calls this when a verification changes. Add the endpoint in the
 * Stripe dashboard (Developers > Webhooks) for the identity.verification_session
 * events and put its signing secret in STRIPE_IDENTITY_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_IDENTITY_WEBHOOK_SECRET) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripeClient(env.STRIPE_SECRET_KEY).webhooks.constructEvent(
      body,
      signature ?? "",
      env.STRIPE_IDENTITY_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({ error: "bad signature" }, { status: 400 });
  }

  if (event.type.startsWith("identity.verification_session.")) {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    try {
      // Fetch the session again with its results rather than trusting the
      // event body, which leaves out the verified details.
      await syncVerification(session.id, "stripe");
    } catch (error) {
      if ((error as { message?: string })?.message === "unknown_session") {
        // Not one of ours (for example a session made in the dashboard).
        return Response.json({ received: true, ignored: true });
      }
      console.error("Stripe Identity webhook failed", error);
      // Stripe retries on errors.
      return Response.json({ error: "processing failed" }, { status: 500 });
    }
  }
  return Response.json({ received: true });
}
