import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { safeNext } from "@/lib/auth/redirect";
import { requireVerifiedMember } from "@/lib/auth/session";
import { completeCouponSession } from "@/lib/coupons/service";
import { serverEnv } from "@/lib/env.server";
import { paymentsStripe, syncSubscription } from "@/lib/payments/stripe";
import { customerId } from "@/lib/payments/subscription";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("upgrade");
  return { title: t("title") };
}

/**
 * Where Stripe Checkout returns after paying. Turns Premium on straight
 * away (without waiting for the webhook), then continues where the member
 * was. Only the member who started the checkout can use it.
 */
export default async function UpgradeSuccessPage({
  searchParams,
}: PageProps<"/upgrade/success">) {
  const t = await getTranslations("upgrade");
  const user = await requireVerifiedMember("/upgrade");
  const params = await searchParams;
  const next = safeNext(params.next, "/details");
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : "";
  if (
    serverEnv().PAYMENTS_PROVIDER !== "stripe" ||
    !sessionId.startsWith("cs_")
  ) {
    redirect("/upgrade");
  }

  const session = await paymentsStripe()
    .checkout.sessions.retrieve(sessionId)
    .catch(() => null);
  if (!session || session.client_reference_id !== user.id) {
    redirect("/upgrade");
  }

  const subscription = customerId(session.subscription);
  if (session.status === "complete" && subscription) {
    await syncSubscription(subscription);
    if (session.metadata?.coupon_id) await completeCouponSession(session.id);
    redirect(`${next}${next.includes("?") ? "&" : "?"}upgraded=1`);
  }

  // Paid by a method that takes a little longer to confirm. The webhook
  // turns Premium on when Stripe confirms it.
  return (
    <section className="mx-auto my-10 flex max-w-md flex-col items-center gap-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-mist text-covenant">
        <Hourglass aria-hidden size={26} />
      </span>
      <h1 className="text-2xl">{t("processingTitle")}</h1>
      <p className="text-ink-soft">{t("processingBody")}</p>
      <Link href="/settings/membership" className={quietButtonClass}>
        {t("seeMembership")}
      </Link>
    </section>
  );
}
