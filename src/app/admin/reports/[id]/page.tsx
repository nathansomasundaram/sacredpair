import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/admin/ConfirmForm";
import { FormAlert } from "@/components/forms/FormAlert";
import { setReportStatus, suspendMember } from "@/lib/admin/actions";
import { getReport } from "@/lib/admin/data";
import { requireStaff } from "@/lib/admin/staff";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReportPage({ params, searchParams }: PageProps<"/admin/reports/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations("admin.report");
  const tStatus = await getTranslations("admin.reports.status");
  const tReasons = await getTranslations("safety.reasons");
  const format = await getFormatter();
  const [r, { done }] = await Promise.all([getReport(id), searchParams]);
  if (!r) notFound();
  const open = r.status === "open" || r.status === "reviewing";
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0">
        <Link href="/admin/reports" className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant">
          <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
          {t("back")}
        </Link>
        {typeof done === "string" && (
          <div className="mb-4">
            <FormAlert tone="success">{t(`done.${done}`)}</FormAlert>
          </div>
        )}
        <h1 className="mb-1 text-2xl sm:text-3xl">{tReasons(r.reason)}</h1>
        <p className="mb-6 text-ink-soft">
          {tStatus(r.status)}{" · "}{when(r.createdAt)}
        </p>

        <dl className="mb-8 grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
          <dt className="text-ink-soft">{t("reported")}</dt>
          <dd>
            {r.reported ? (
              <Link href={`/admin/members/${r.reported.id}`} className="font-semibold text-covenant underline underline-offset-4">
                {r.reported.name}{" ("}{r.reported.email}{")"}
              </Link>
            ) : (
              "—"
            )}
            {r.reported?.suspended && <span className="ms-2 rounded-full bg-danger/10 px-2 text-[0.8125rem] text-danger">{t("suspended")}</span>}
          </dd>
          <dt className="text-ink-soft">{t("reporter")}</dt>
          <dd>
            {r.reporter ? (
              <Link href={`/admin/members/${r.reporter.id}`} className="text-covenant underline underline-offset-4">
                {r.reporter.name}{" ("}{r.reporter.email}{")"}
              </Link>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-ink-soft">{t("details")}</dt>
          <dd className="whitespace-pre-wrap">{r.details || t("noDetails")}</dd>
          <dt className="text-ink-soft">{t("otherReports")}</dt>
          <dd>{r.otherReports}</dd>
          {r.reviewedBy && (
            <>
              <dt className="text-ink-soft">{t("reviewedBy")}</dt>
              <dd>
                {r.reviewedBy.name}
                {r.note && <span className="block whitespace-pre-wrap text-ink-soft">{r.note}</span>}
              </dd>
            </>
          )}
        </dl>

        <section aria-labelledby="conversation-heading">
          <h2 id="conversation-heading" className="mb-1 text-xl">
            {t("conversation")}
          </h2>
          <p className="mb-4 text-[0.9375rem] text-ink-soft">{t("conversationNote")}</p>
          {r.conversation.length === 0 ? (
            <p className="text-ink-soft">{t("noConversation")}</p>
          ) : (
            <ol className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto rounded-2xl border border-line p-4">
              {r.conversation.map((m) => (
                <li
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${m.fromReported ? "self-start bg-danger/[0.07]" : "self-end bg-mist"} ${m.id === r.messageId ? "ring-2 ring-danger" : ""}`}
                >
                  <span className="block text-[0.8125rem] font-semibold text-ink-soft">
                    {m.fromReported ? r.reported?.name : r.reporter?.name}{" · "}{when(m.at)}
                  </span>
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside aria-label={t("actions")} className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-xl">{t("actions")}</h2>
        {open ? (
          <>
            {r.status === "open" && (
              <ActionForm action={setReportStatus} summary={t("markReviewing")} button={t("markReviewing")} hidden={{ reportId: r.id, status: "reviewing" }} />
            )}
            <ActionForm action={setReportStatus} summary={t("resolve")} button={t("resolve")} hidden={{ reportId: r.id, status: "resolved" }} noteLabel={t("note")} />
            <ActionForm action={setReportStatus} summary={t("dismiss")} button={t("dismiss")} hidden={{ reportId: r.id, status: "dismissed" }} noteLabel={t("note")} />
            {r.reported && !r.reported.suspended && (
              <ActionForm
                action={suspendMember}
                summary={t("suspend", { name: r.reported.name })}
                button={t("suspendButton")}
                hidden={{ userId: r.reported.id, reportId: r.id }}
                noteLabel={t("suspendNote")}
                danger
              />
            )}
            {r.reported && (
              <Link href={`/admin/members/${r.reported.id}`} className="font-semibold text-covenant underline underline-offset-4">
                {t("removeContent")}
              </Link>
            )}
          </>
        ) : (
          <p className="text-ink-soft">{t("closed")}</p>
        )}
      </aside>
    </div>
  );
}
