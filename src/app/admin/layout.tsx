import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { Wordmark } from "@/components/brand/Wordmark";
import { getOverview } from "@/lib/admin/data";
import { requireStaff } from "@/lib/admin/staff";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The moderation area: staff only. Everyone else gets "not found". */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const t = await getTranslations("admin");
  const counts = await getOverview();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="me-auto flex items-center gap-3">
            <Wordmark size={24} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-[0.8125rem] font-semibold text-paper">
              <ShieldCheck aria-hidden size={14} />
              {t("badge")}
            </span>
          </Link>
          <span className="text-[0.9375rem] text-ink-soft">
            {t("signedInAs", { email: staff.email ?? "", role: t(`roles.${staff.role}`) })}
          </span>
          <Link href="/discover" className="text-[0.9375rem] font-semibold text-covenant underline underline-offset-4">
            {t("backToApp")}
          </Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <AdminNav isAdmin={staff.role === "admin"} openReports={counts.openReports} pendingStories={counts.pendingStories} />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
