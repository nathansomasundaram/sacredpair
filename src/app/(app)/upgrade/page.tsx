import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  Crown,
  Images,
  ListChecks,
  MessageCircle,
  MessageSquareQuote,
  SlidersHorizontal,
  Sprout,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PairMark } from "@/components/brand/PairMark";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { safeNext } from "@/lib/auth/redirect";
import { requireVerifiedMember } from "@/lib/auth/session";
import {
  discountedAmount,
  normalizeCode,
  type CouponTerms,
} from "@/lib/coupons/pricing";
import {
  assignedCouponCode,
  previewCoupon,
  type CouponResult,
} from "@/lib/coupons/service";
import { serverEnv } from "@/lib/env.server";
import { startCheckout } from "@/lib/payments/actions";
import { getPlans, type Plan } from "@/lib/payments/stripe";
import { endTestPremium, startTestPremium } from "@/lib/premium/actions";
import { getMembership } from "@/lib/premium/data";
import { TEST_PREMIUM_DAYS } from "@/lib/premium/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("upgrade");
  return { title: t("title") };
}

const BENEFITS = [
  { key: "chat", icon: MessageCircle },
  { key: "together", icon: Sprout },
  { key: "photos", icon: Images },
  { key: "prompts", icon: MessageSquareQuote },
  { key: "details", icon: ListChecks },
  { key: "filters", icon: SlidersHorizontal },
] as const;

/** The upgrade screen free members reach from "Know more", Chat or Together. */
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
  const provider = serverEnv().PAYMENTS_PROVIDER;
  const testMode = provider === "simulated";
  let plans: Plan[] | null = null;
  if (provider === "stripe" && !membership.premium) {
    plans = await getPlans().catch((e) => {
      console.error("Couldn't load Premium prices from Stripe", e);
      return [];
    });
  }

  // A coupon code, typed here or arriving in a link (/upgrade?coupon=CODE),
  // is checked for each plan so the cards can show the discounted price.
  const couponCode = plans?.length ? normalizeCode(params.coupon) : "";
  const offers = new Map<Plan["key"], CouponResult>();
  if (plans && couponCode) {
    for (const p of plans) {
      offers.set(
        p.key,
        await previewCoupon(couponCode, user.id, p.key, p.currency),
      );
    }
  }
  // A code staff plugged into this member is offered until they use it.
  const suggested =
    plans?.length && !couponCode ? await assignedCouponCode(user.id) : null;
  const offerList = [...offers.values()];
  const couponApplied = offerList.some((o) => o.ok);
  const couponError =
    couponCode && !couponApplied
      ? (offerList
          .map((o) => (o.ok ? null : o.error))
          .find((e) => e && e !== "wrong_plan") ?? "wrong_plan")
      : null;

  const money = (p: Plan, amount = p.amount) =>
    format.number(amount / 100, {
      style: "currency",
      currency: p.currency.toUpperCase(),
      minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
    });
  const monthly = plans?.find((p) => p.key === "monthly");
  const yearly = plans?.find((p) => p.key === "yearly");
  const yearlySaving =
    monthly && yearly && monthly.currency === yearly.currency
      ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100)
      : 0;

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
      {params.canceled === "1" && !membership.premium && (
        <div className="mt-6">
          <FormAlert tone="success">{t("checkoutCanceled")}</FormAlert>
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
            {membership.source === "stripe" && (
              <Link
                href="/settings/membership"
                className="font-semibold text-covenant underline underline-offset-4"
              >
                {t("manage")}
              </Link>
            )}
            {testMode && membership.source === "simulated" && (
              <form action={endTestPremium}>
                <SubmitButton variant="quiet">{t("endTest")}</SubmitButton>
              </form>
            )}
          </>
        ) : plans ? (
          plans.length > 0 ? (
            <>
              <h2 className="text-xl">{t("choosePlan")}</h2>
              <form
                method="get"
                action="/upgrade"
                className="flex w-full flex-wrap items-end gap-3"
              >
                <input type="hidden" name="next" value={next} />
                <label className="flex w-full max-w-xs flex-col gap-1.5">
                  <span className="font-semibold">{t("coupon.label")}</span>
                  <input
                    name="coupon"
                    defaultValue={couponCode}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={40}
                    className="min-h-12 rounded-xl border border-line bg-paper px-3 uppercase"
                  />
                </label>
                <SubmitButton variant="quiet">{t("coupon.apply")}</SubmitButton>
              </form>
              {suggested && (
                <FormAlert tone="success">
                  <p>{t("coupon.suggested", { code: suggested })}</p>
                  <Link
                    href={`/upgrade?next=${encodeURIComponent(next)}&coupon=${encodeURIComponent(suggested)}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    {t("coupon.useIt")}
                  </Link>
                </FormAlert>
              )}
              {couponApplied && (
                <FormAlert tone="success">
                  {t("coupon.applied", { code: couponCode })}
                </FormAlert>
              )}
              {couponError && (
                <FormAlert tone="error">
                  {t(`coupon.errors.${couponError}`)}
                </FormAlert>
              )}
              <ul className="grid w-full gap-3 sm:grid-cols-2">
                {[monthly, yearly].map((plan) => {
                  if (!plan) return null;
                  const offer = offers.get(plan.key);
                  const terms: CouponTerms | null = offer?.ok
                    ? offer.terms
                    : null;
                  const price = terms
                    ? discountedAmount(plan.amount, plan.currency, terms)
                    : plan.amount;
                  return (
                    <li key={plan.key}>
                      <form
                        action={startCheckout}
                        className="flex h-full flex-col gap-3 rounded-2xl border border-line p-5"
                      >
                        <input type="hidden" name="plan" value={plan.key} />
                        <input type="hidden" name="next" value={next} />
                        {terms && (
                          <input
                            type="hidden"
                            name="coupon"
                            value={couponCode}
                          />
                        )}
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {t(`plans.${plan.key}.title`)}
                          {plan.key === "yearly" && yearlySaving > 0 && (
                            <span className="rounded-full bg-ring/20 px-2 py-0.5 text-[0.8125rem]">
                              {t("plans.save", { percent: yearlySaving })}
                            </span>
                          )}
                        </p>
                        <p className="font-display text-3xl">
                          {t(`plans.${plan.key}.price`, {
                            price: money(plan, price),
                          })}
                        </p>
                        {terms && (
                          <p className="text-[0.9375rem] text-ink-soft">
                            <s>
                              <span className="sr-only">
                                {t("coupon.regularPrice")}
                              </span>
                              {money(plan)}
                            </s>{" "}
                            {terms.percentOff !== null
                              ? t("coupon.percentOff", {
                                  percent: terms.percentOff,
                                })
                              : t("coupon.amountOff", {
                                  amount: money(
                                    plan,
                                    terms.amountOffCents ?? 0,
                                  ),
                                })}{" "}
                            {t(`coupon.duration.${terms.duration}`, {
                              months: terms.durationMonths ?? 0,
                            })}
                          </p>
                        )}
                        {couponApplied && !terms && (
                          <p className="text-[0.9375rem] text-ink-soft">
                            {t("coupon.notForPlan")}
                          </p>
                        )}
                        {plan.key === "yearly" && (
                          <p className="text-[0.9375rem] text-ink-soft">
                            {t("plans.yearly.perMonth", {
                              price: money(plan, Math.round(plan.amount / 12)),
                            })}
                          </p>
                        )}
                        <div className="mt-auto">
                          <SubmitButton>
                            <Crown aria-hidden size={18} />
                            {t(`plans.${plan.key}.choose`)}
                          </SubmitButton>
                        </div>
                      </form>
                    </li>
                  );
                })}
              </ul>
              <p className="max-w-prose text-[0.9375rem] text-ink-soft">
                {t("stripeNote")}
              </p>
            </>
          ) : (
            <FormAlert tone="error">{t("pricesUnavailable")}</FormAlert>
          )
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
