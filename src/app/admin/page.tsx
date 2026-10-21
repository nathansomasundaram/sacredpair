import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getOverview } from "@/lib/admin/data";
import { requireStaff } from "@/lib/admin/staff";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function AdminHome() {
  await requireStaff();
  const t = await getTranslations("admin.overview");
  const c = await getOverview();
  const cards = [
    { key: "openReports", value: c.openReports, href: "/admin/reports", urgent: c.openReports > 0 },
    { key: "reviewing", value: c.reviewing, href: "/admin/reports?status=reviewing" },
    { key: "pendingStories", value: c.pendingStories, href: "/admin/stories", urgent: c.pendingStories > 0 },
    { key: "members", value: c.membersTotal, href: "/admin/members" },
    { key: "verified", value: c.verified },
    { key: "premium", value: c.premium },
    { key: "suspended", value: c.suspended },
  ] as const;
  return (
    <>
      <h1 className="mb-6 text-2xl sm:text-3xl">{t("title")}</h1>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const body = (
            <>
              <span className={`font-display text-3xl ${"urgent" in card && card.urgent ? "text-danger" : ""}`}>{card.value}</span>
              <span className="text-ink-soft">{t(card.key)}</span>
            </>
          );
          return (
            <li key={card.key}>
              {"href" in card && card.href ? (
                <Link href={card.href} className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-paper p-5 hover:bg-mist/60">
                  {body}
                </Link>
              ) : (
                <div className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-paper p-5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-8 max-w-prose text-ink-soft">{t("note")}</p>
    </>
  );
}
