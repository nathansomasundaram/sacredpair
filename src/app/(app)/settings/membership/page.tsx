import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Crown } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { primaryButtonClass } from "@/components/ui/buttonStyles";
import { requireVerifiedMember } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { openBillingPortal } from "@/lib/payments/actions";
import { endTestPremium } from "@/lib/premium/actions";
import { getMembership } from "@/lib/premium/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.membership");
  return { title: t("title") };
}

/** The member's plan, and where payment is managed. */
export default async function MembershipPage() {
  const t = await getTranslations("settings.membership");
  const format = await getFormatter();
  const user = await requireVerifiedMember("/settings/membership");
  const m = await getMembership(user.id);
  const provider = serverEnv().PAYMENTS_PROVIDER;
  const testMode = provider === "simulated";
  const until = m.expiresAt
    ? format.dateTime(new Date(m.expiresAt), {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="max-w-xl">
      <SettingsHeader title={t("title")} />

      <section
        aria-labelledby="plan-heading"
        className="mt-6 rounded-2xl border border-line p-5"
      >
        <h2
          id="plan-heading"
          className="mb-3 font-sans text-base font-semibold text-ink-soft"
        >
          {t("planHeading")}
        </h2>
        <p className="mb-1 flex items-center gap-2 text-2xl font-display">
          {m.premium && <Crown aria-hidden size={22} className="text-ring" />}
          {m.premium ? t("premium") : t("free")}
        </p>
        <p className="mb-4 text-ink-soft">
          {m.premium
            ? m.source === "simulated"
              ? until
                ? t("testUntil", { date: until })
                : t("test")
              : until
                ? t(m.renews ? "renews" : "ends", { date: until })
                : t("premiumActive")
            : t("freeBody")}
        </p>
        {!m.premium && (
          <Link
            href="/upgrade?next=/settings/membership"
            className={primaryButtonClass}
          >
            <Crown aria-hidden size={18} />
            {t("seePremium")}
          </Link>
        )}
        {m.premium && m.source === "simulated" && testMode && (
          <form action={endTestPremium}>
            <SubmitButton variant="quiet">{t("endTest")}</SubmitButton>
          </form>
        )}
      </section>

      <section
        aria-labelledby="payment-heading"
        className="mt-6 rounded-2xl border border-line p-5"
      >
        <h2
          id="payment-heading"
          className="mb-3 flex items-center gap-2 font-sans text-base font-semibold text-ink-soft"
        >
          <CreditCard aria-hidden size={18} />
          {t("paymentHeading")}
        </h2>
        {provider === "stripe" && m.premium && m.source === "stripe" ? (
          <form
            action={openBillingPortal}
            className="flex flex-col items-start gap-3"
          >
            <p>{t("paymentStripe")}</p>
            <SubmitButton variant="quiet">{t("managePayment")}</SubmitButton>
          </form>
        ) : provider === "stripe" && m.hasBilling ? (
          <form
            action={openBillingPortal}
            className="flex flex-col items-start gap-3"
          >
            <p>{t("paymentPast")}</p>
            <SubmitButton variant="quiet">{t("seeReceipts")}</SubmitButton>
          </form>
        ) : provider === "stripe" ? (
          <p>{t("paymentNotYet")}</p>
        ) : (
          <p>{t("paymentBody")}</p>
        )}
        <p className="mt-3 text-[0.9375rem] text-ink-soft">
          {t("paymentApps")}
        </p>
      </section>
    </div>
  );
}
