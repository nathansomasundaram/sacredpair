import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { CouponDiscount } from "@/components/admin/CouponDiscount";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { requireAdmin } from "@/lib/admin/staff";
import { listCoupons } from "@/lib/coupons/admin-data";
import { createCoupon } from "@/lib/coupons/admin-actions";
import { couponState } from "@/lib/coupons/pricing";

const input = "min-h-12 rounded-xl border border-line bg-paper px-3";

export default async function CouponsPage({
  searchParams,
}: PageProps<"/admin/coupons">) {
  await requireAdmin();
  const t = await getTranslations("admin.coupons");
  const format = await getFormatter();
  const [coupons, { error }] = await Promise.all([listCoupons(), searchParams]);
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-2xl sm:text-3xl">{t("title")}</h1>
        <Link
          href="/admin/coupons/partners"
          className="font-semibold text-covenant underline underline-offset-4"
        >
          {t("partnersLink")}
        </Link>
      </div>
      <p className="mb-6 max-w-2xl text-ink-soft">{t("intro")}</p>

      {typeof error === "string" && (
        <div className="mb-4 max-w-2xl">
          <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert>
        </div>
      )}

      {coupons.length === 0 ? (
        <p className="mb-8 text-ink-soft">{t("none")}</p>
      ) : (
        <div className="mb-10 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[48rem] text-start text-[0.9375rem]">
            <thead className="bg-mist/60 text-start">
              <tr>
                {["code", "discount", "uses", "source", "ends", "status"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-2 text-start font-semibold"
                    >
                      {t(`cols.${h}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/coupons/${c.id}`}
                      className="font-mono font-semibold text-covenant underline underline-offset-4"
                    >
                      {c.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <CouponDiscount coupon={c} />
                  </td>
                  <td className="px-4 py-2">
                    {c.maxRedemptions === null
                      ? t("usesUnlimited", { count: c.redeemed })
                      : t("uses", { count: c.redeemed, max: c.maxRedemptions })}
                  </td>
                  <td className="px-4 py-2">
                    {c.partnerName
                      ? t("fromPartner", { name: c.partnerName })
                      : c.membersOnly
                        ? t("forMembers", { count: c.assigned })
                        : t("fromStaff")}
                  </td>
                  <td className="px-4 py-2">
                    {c.expiresAt
                      ? format.dateTime(new Date(c.expiresAt), {
                          dateStyle: "medium",
                        })
                      : t("never")}
                  </td>
                  <td className="px-4 py-2">{t(`state.${couponState(c)}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        action={createCoupon}
        className="flex max-w-2xl flex-col items-start gap-5 rounded-2xl border border-line p-5"
      >
        <h2 className="text-xl">{t("new.title")}</h2>

        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="coupon-code" className="font-semibold">
            {t("new.code")}
          </label>
          <input
            id="coupon-code"
            name="code"
            required
            minLength={4}
            maxLength={32}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="coupon-code-hint"
            className={`${input} font-mono uppercase`}
          />
          <span id="coupon-code-hint" className="text-[0.875rem] text-ink-soft">
            {t("new.codeHint")}
          </span>
        </div>

        <label className="flex w-full flex-col gap-1.5">
          <span className="font-semibold">{t("new.description")}</span>
          <input name="description" maxLength={200} className={input} />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("new.kind")}</span>
            <select name="kind" className={input}>
              <option value="percent">{t("new.kindPercent")}</option>
              <option value="amount">{t("new.kindAmount")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("new.value")}</span>
            <input
              name="value"
              required
              inputMode="decimal"
              className={`${input} w-32`}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("new.duration")}</span>
            <select name="duration" className={input}>
              <option value="once">{t("new.durationOnce")}</option>
              <option value="repeating">{t("new.durationRepeating")}</option>
              <option value="forever">{t("new.durationForever")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("new.months")}</span>
            <input
              name="months"
              inputMode="numeric"
              className={`${input} w-32`}
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{t("new.plans")}</legend>
          {(["monthly", "yearly"] as const).map((p) => (
            <label key={p} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="plans"
                value={p}
                defaultChecked
                className="size-5"
              />
              {t(`plan.${p}`)}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("new.max")}</span>
            <input name="max" inputMode="numeric" className={`${input} w-32`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("new.starts")}</span>
            <input name="starts" type="date" className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("new.expires")}</span>
            <input name="expires" type="date" className={input} />
          </label>
        </div>

        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="membersOnly" className="size-5" />
          <span>{t("new.membersOnly")}</span>
        </label>
        <p className="-mt-3 text-[0.875rem] text-ink-soft">
          {t("new.membersOnlyHint")}
        </p>

        <SubmitButton>{t("new.create")}</SubmitButton>
      </form>
    </>
  );
}
