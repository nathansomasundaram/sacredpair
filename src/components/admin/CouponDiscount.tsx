import { getFormatter, getTranslations } from "next-intl/server";
import type { CouponDuration } from "@/lib/coupons/pricing";

/** "20% off, on the first payment" for the admin lists. */
export async function CouponDiscount({
  coupon,
}: {
  coupon: {
    percentOff: number | null;
    amountOffCents: number | null;
    currency: string;
    duration: CouponDuration;
    durationMonths: number | null;
  };
}) {
  const t = await getTranslations("admin.coupons");
  const format = await getFormatter();
  const what =
    coupon.percentOff !== null
      ? t("percentOff", { percent: coupon.percentOff })
      : t("amountOff", {
          amount: format.number((coupon.amountOffCents ?? 0) / 100, {
            style: "currency",
            currency: coupon.currency.toUpperCase(),
          }),
        });
  return (
    <>
      {what}
      {", "}
      {t(`duration.${coupon.duration}`, { months: coupon.durationMonths ?? 0 })}
    </>
  );
}
