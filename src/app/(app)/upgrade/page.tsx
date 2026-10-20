import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  Crown,
  Images,
  ListChecks,
  MessageSquareQuote,
  SlidersHorizontal,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PairMark } from "@/components/brand/PairMark";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { safeNext } from "@/lib/auth/redirect";
import { requireVerifiedMember } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { endTestPremium, startTestPremium } from "@/lib/premium/actions";
import { getMembership } from "@/lib/premium/data";
import { TEST_PREMIUM_DAYS } from "@/lib/premium/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("upgrade");
  return { title: t("title") };
}

const BENEFITS = [
  { key: "photos", icon: Images },
  { key: "prompts", icon: MessageSquareQuote },
  { key: "details", icon: ListChecks },
  { key: "filters", icon: SlidersHorizontal, soon: true },
] as const;

/** The upgrade screen free members reach from "Know more". */
export default async function UpgradePage({
  searchParams,
}: PageProps<"/upgrade">) {
  const t = await getTranslations("upgrade");
  const format = await getFormatter();
  const user = await requireVerifiedMember("/upgrade");
  const [membership, params] = await Promise.all([
    getMembership(user.id),
    searchParams,
  ]);
  const next = safeNext(params.next, "/details");
  const testMode = serverEnv().PAYMENTS_PROVIDER === "simulated";

  const until = membership.expiresAt
    ? format.dateTime(new Date(membership.expiresAt), {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <>
      <Link
        href={next}
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant"
      >
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {t("back")}
      </Link>

      <section className="relative overflow-hidden rounded-3xl border border-ring/60 bg-ring/10 px-6 py-8 sm:px-10 sm:py-10">
        <PairMark
          size={220}
          woven={false}
          className="pointer-events-none absolute -end-12 -top-10 opacity-15"
        />
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-paper/80 px-3 py-1 text-[0.875rem] font-semibold">
          <Crown aria-hidden size={15} className="text-ring" />
          {t("eyebrow")}
        </p>
        <h1 className="mb-3 max-w-md text-3xl">{t("headline")}</h1>
        <p className="max-w-md text-lg text-ink-soft">{t("lead")}</p>
      </section>

      {params.ended === "1" && (
        <div className="mt-6">
          <FormAlert tone="success">{t("ended")}</FormAlert>
        </div>
      )}

      <ul className="mt-8 flex flex-col gap-5">
        {BENEFITS.map(({ key, icon: Icon, ...rest }) => (
          <li key={key} className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mist text-covenant">
              <Icon aria-hidden size={21} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {t(`benefits.${key}.title`)}
                {"soon" in rest && (
                  <span className="rounded-full border border-line px-2 py-0.5 text-[0.8125rem] font-normal text-ink-soft">
                    {t("soon")}
                  </span>
                )}
              </span>
              <span className="text-ink-soft">{t(`benefits.${key}.body`)}</span>
            </span>
          </li>
        ))}
      </ul>

      <section
        aria-labelledby="plan-heading"
        className="mt-10 flex flex-col items-start gap-4 border-t border-line pt-8"
      >
        <h2 id="plan-heading" className="sr-only">
          {t("planHeading")}
        </h2>
        {membership.premium ? (
          <>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Crown aria-hidden size={20} className="text-ring" />
              {until
                ? t(
                    membership.source === "simulated"
                      ? "activeTestUntil"
                      : "activeUntil",
                    { date: until },
                  )
                : t("active")}
            </p>
            <Link href={next} className={quietButtonClass}>
              {t("continue")}
            </Link>
            {testMode && membership.source === "simulated" && (
              <form action={endTestPremium}>
                <SubmitButton variant="quiet">{t("endTest")}</SubmitButton>
              </form>
            )}
          </>
        ) : testMode ? (
          <>
            <form action={startTestPremium}>
              <input type="hidden" name="next" value={next} />
              <SubmitButton>
                <Crown aria-hidden size={18} />
                {t("startTest", { days: TEST_PREMIUM_DAYS })}
              </SubmitButton>
            </form>
            <p className="max-w-prose text-[0.9375rem] text-ink-soft">
              {t("testNote")}
            </p>
          </>
        ) : (
          <FormAlert tone="success">
            <p className="font-semibold">{t("soonTitle")}</p>
            <p>{t("soonBody")}</p>
          </FormAlert>
        )}
      </section>
    </>
  );
}
