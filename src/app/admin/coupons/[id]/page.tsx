import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { CouponDiscount } from "@/components/admin/CouponDiscount";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { requireAdmin } from "@/lib/admin/staff";
import {
  assignCoupon,
  unassignCoupon,
  updateCoupon,
} from "@/lib/coupons/admin-actions";
import { getCoupon } from "@/lib/coupons/admin-data";
import { couponState } from "@/lib/coupons/pricing";

const input = "min-h-12 rounded-xl border border-line bg-paper px-3";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CouponPage({
  params,
  searchParams,
}: PageProps<"/admin/coupons/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const found = await getCoupon(id);
  if (!found) notFound();
  const { coupon: c, members, redemptions } = found;
  const t = await getTranslations("admin.coupons");
  const format = await getFormatter();
  const { done, error } = await searchParams;
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/coupons"
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant"
      >
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {t("back")}
      </Link>
      <h1 className="mb-1 font-mono text-2xl sm:text-3xl">{c.code}</h1>
      <p className="mb-1 text-ink-soft">
        <CouponDiscount coupon={c} />
        {" · "}
        {c.plans.map((p) => t(`plan.${p}`)).join(", ")}
        {" · "}
        {t(`state.${couponState(c)}`)}
      </p>
      <p className="mb-6 text-[0.9375rem] text-ink-soft">
        {c.partnerName
          ? t("fromPartner", { name: c.partnerName })
          : t("fromStaff")}
        {" · "}
        {c.maxRedemptions === null
          ? t("usesUnlimited", { count: c.redeemed })
          : t("uses", { count: c.redeemed, max: c.maxRedemptions })}
      </p>

      {typeof done === "string" && (
        <div className="mb-4">
          <FormAlert tone="success">{t(`done.${done}`)}</FormAlert>
        </div>
      )}
      {typeof error === "string" && (
        <div className="mb-4">
          <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert>
        </div>
      )}

      <form
        action={updateCoupon}
        className="mb-8 flex flex-col items-start gap-5 rounded-2xl border border-line p-5"
      >
        <input type="hidden" name="couponId" value={c.id} />
        <h2 className="text-xl">{t("edit.title")}</h2>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="active"
            defaultChecked={c.active}
            className="size-5"
          />
          <span>{t("edit.active")}</span>
        </label>
        <label className="flex w-full flex-col gap-1.5">
          <span className="font-semibold">{t("new.description")}</span>
          <input
            name="description"
            defaultValue={c.description}
            maxLength={200}
            className={input}
          />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("new.max")}</span>
            <input
              name="max"
              inputMode="numeric"
              defaultValue={c.maxRedemptions ?? ""}
              className={`${input} w-32`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("new.expires")}</span>
            <input
              name="expires"
              type="date"
              defaultValue={day(c.expiresAt)}
              className={input}
            />
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="membersOnly"
            defaultChecked={c.membersOnly}
            className="size-5"
          />
          <span>{t("new.membersOnly")}</span>
        </label>
        <SubmitButton>{t("edit.save")}</SubmitButton>
      </form>

      <section aria-labelledby="members-heading" className="mb-8">
        <h2 id="members-heading" className="mb-2 text-xl">
          {t("members.title")}
        </h2>
        <p className="mb-3 text-[0.9375rem] text-ink-soft">
          {c.membersOnly ? t("members.onlyThem") : t("members.anyone")}
        </p>
        {members.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3"
              >
                <span className="me-auto">
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-[0.9375rem] text-ink-soft">
                    {m.email}
                  </span>
                </span>
                <form action={unassignCoupon}>
                  <input type="hidden" name="couponId" value={c.id} />
                  <input type="hidden" name="userId" value={m.id} />
                  <SubmitButton variant="quiet">
                    {t("members.remove")}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form
          action={assignCoupon}
          className="flex flex-col items-start gap-4 rounded-2xl border border-line p-5"
        >
          <input type="hidden" name="couponId" value={c.id} />
          <label className="flex w-full flex-col gap-1.5">
            <span className="font-semibold">{t("members.email")}</span>
            <input name="email" type="email" required className={input} />
          </label>
          <p className="text-[0.875rem] text-ink-soft">{t("members.hint")}</p>
          <SubmitButton>{t("members.add")}</SubmitButton>
        </form>
      </section>

      <section aria-labelledby="used-heading">
        <h2 id="used-heading" className="mb-2 text-xl">
          {t("used.title")}
        </h2>
        {redemptions.length === 0 ? (
          <p className="text-ink-soft">{t("used.none")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {redemptions.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-line px-4 py-3 text-[0.9375rem]"
              >
                <span className="block font-semibold">{r.name}</span>
                <span className="block text-ink-soft">
                  {r.email}
                  {" · "}
                  {t(`plan.${r.plan}`)}
                  {" · "}
                  {t(`used.${r.status}`, { date: date(r.at) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
