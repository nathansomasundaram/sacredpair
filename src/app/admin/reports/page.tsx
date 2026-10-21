import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { listReports, REPORT_STATUSES, type ReportStatus } from "@/lib/admin/data";
import { requireStaff } from "@/lib/admin/staff";

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireStaff();
  const t = await getTranslations("admin.reports");
  const tReasons = await getTranslations("safety.reasons");
  const format = await getFormatter();
  const raw = (await searchParams).status;
  const status: ReportStatus = REPORT_STATUSES.includes(raw as ReportStatus) ? (raw as ReportStatus) : "open";
  const reports = await listReports(status);
  return (
    <>
      <h1 className="mb-4 text-2xl sm:text-3xl">{t("title")}</h1>
      <nav aria-label={t("filter")} className="mb-6 flex flex-wrap gap-2">
        {REPORT_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-[0.9375rem] font-semibold ${s === status ? "border-covenant bg-covenant/10 text-covenant" : "border-line text-ink-soft hover:bg-mist"}`}
          >
            {t(`status.${s}`)}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <p className="text-ink-soft">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/reports/${r.id}`}
                className="grid gap-1 rounded-2xl border border-line bg-paper p-4 hover:bg-mist/60 sm:grid-cols-[10rem_1fr_auto] sm:items-center sm:gap-4"
              >
                <span className="font-semibold">{tReasons(r.reason)}</span>
                <span className="min-w-0">
                  <span className="block truncate">
                    {t("about", { name: r.reported?.name ?? "—", email: r.reported?.email ?? "" })}
                  </span>
                  {r.details && <span className="block truncate text-[0.9375rem] text-ink-soft">{r.details}</span>}
                </span>
                <span className="text-[0.875rem] text-ink-soft">{format.relativeTime(new Date(r.createdAt), new Date())}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
