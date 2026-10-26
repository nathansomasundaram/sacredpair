import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PartnerForm } from "@/components/admin/PartnerForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { requireAdmin } from "@/lib/admin/staff";
import {
  endPartnerCoupons,
  setPartnerActive,
} from "@/lib/coupons/admin-actions";
import { listPartners } from "@/lib/coupons/admin-data";

export default async function PartnersPage() {
  await requireAdmin();
  const t = await getTranslations("admin.coupons");
  const format = await getFormatter();
  const partners = await listPartners();
  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/coupons"
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant"
      >
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {t("back")}
      </Link>
      <h1 className="mb-2 text-2xl sm:text-3xl">{t("partners.title")}</h1>
      <p className="mb-6 text-ink-soft">{t("partners.intro")}</p>

      {partners.length === 0 ? (
        <p className="mb-8 text-ink-soft">{t("partners.none")}</p>
      ) : (
        <ul className="mb-8 flex flex-col gap-2">
          {partners.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3"
            >
              <span className="me-auto">
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-[0.9375rem] text-ink-soft">
                  {t("partners.summary", {
                    percent: p.maxPercentOff,
                    count: p.coupons,
                    date: format.dateTime(new Date(p.createdAt), {
                      dateStyle: "medium",
                    }),
                  })}
                  {" · "}
                  {p.active ? t("partners.on") : t("partners.off")}
                </span>
              </span>
              <form action={setPartnerActive}>
                <input type="hidden" name="partnerId" value={p.id} />
                <input
                  type="hidden"
                  name="active"
                  value={p.active ? "0" : "1"}
                />
                <SubmitButton variant="quiet">
                  {p.active ? t("partners.turnOff") : t("partners.turnOn")}
                </SubmitButton>
              </form>
              {p.coupons > 0 && (
                <form action={endPartnerCoupons}>
                  <input type="hidden" name="partnerId" value={p.id} />
                  <SubmitButton variant="quiet">
                    {t("partners.endCoupons")}
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <PartnerForm />
    </div>
  );
}
