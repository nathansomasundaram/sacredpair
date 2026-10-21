import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/admin/ConfirmForm";
import { FormAlert } from "@/components/forms/FormAlert";
import { reinstateMember, removeContent, suspendMember } from "@/lib/admin/actions";
import { getMember } from "@/lib/admin/data";
import { requireStaff } from "@/lib/admin/staff";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MemberPage({ params, searchParams }: PageProps<"/admin/members/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations("admin.member");
  const tActions = await getTranslations("admin.actions");
  const tReasons = await getTranslations("safety.reasons");
  const tStatus = await getTranslations("admin.reports.status");
  const format = await getFormatter();
  const [m, { done }] = await Promise.all([getMember(id), searchParams]);
  if (!m) notFound();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
  const remove = (what: string, label: string, extra: Record<string, string> = {}) => (
    <ActionForm
      action={removeContent}
      summary={label}
      button={label}
      hidden={{ userId: m.id, what, ...extra }}
      noteLabel={t("note")}
      danger
    />
  );

  return (
    <>
      <Link href="/admin/members" className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant">
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {t("back")}
      </Link>
      {typeof done === "string" && (
        <div className="mb-4">
          <FormAlert tone="success">{t(`done.${done}`)}</FormAlert>
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <h1 className="mb-1 flex flex-wrap items-center gap-3 text-2xl sm:text-3xl">
            {m.name}
            {m.suspendedAt && (
              <span className="rounded-full bg-danger/10 px-3 py-0.5 font-sans text-base text-danger">
                {t("suspendedOn", { date: date(m.suspendedAt) })}
              </span>
            )}
          </h1>
          <p className="mb-6 text-ink-soft">{m.email}</p>

          <dl className="mb-8 grid gap-x-6 gap-y-2 sm:grid-cols-[11rem_1fr]">
            <dt className="text-ink-soft">{t("place")}</dt>
            <dd>{[m.city, m.stateCode].filter(Boolean).join(", ") || "—"}</dd>
            <dt className="text-ink-soft">{t("joined")}</dt>
            <dd>{date(m.joined)}</dd>
            <dt className="text-ink-soft">{t("id")}</dt>
            <dd>{m.idVerified ? t("yes") : t("no")}</dd>
            <dt className="text-ink-soft">{t("phone")}</dt>
            <dd>{m.phone ? `${m.phone} (${m.phoneVerified ? t("verified") : t("notVerified")})` : "—"}</dd>
            <dt className="text-ink-soft">{t("plan")}</dt>
            <dd>{m.premium ? t("premium") : t("free")}</dd>
            <dt className="text-ink-soft">{t("visible")}</dt>
            <dd>{m.visible ? t("yes") : t("no")}</dd>
            <dt className="text-ink-soft">{t("reportsFiled")}</dt>
            <dd>{m.reportsFiled}</dd>
          </dl>

          <section aria-labelledby="content-heading" className="mb-8">
            <h2 id="content-heading" className="mb-3 text-xl">
              {t("content")}
            </h2>
            <div className="mb-4 flex flex-wrap gap-3">
              {m.photoUrl ? (
                <div className="relative h-40 w-32 overflow-hidden rounded-xl bg-mist">
                  <Image src={m.photoUrl} alt={t("mainPhoto")} fill sizes="128px" unoptimized className="object-cover" />
                </div>
              ) : (
                <p className="text-ink-soft">{t("noPhoto")}</p>
              )}
              {m.extraPhotos.map((p, i) =>
                p.url ? (
                  <div key={p.id} className="relative h-40 w-32 overflow-hidden rounded-xl bg-mist">
                    <Image src={p.url} alt={t("extraPhoto", { n: i + 1 })} fill sizes="128px" unoptimized className="object-cover" />
                  </div>
                ) : null,
              )}
            </div>
            <p className="mb-2 font-semibold">{t("about")}</p>
            <p className="mb-4 whitespace-pre-wrap rounded-xl bg-mist/60 px-4 py-3">{m.aboutMe || "—"}</p>
            {m.videoUrl && (
              <video src={m.videoUrl} controls preload="metadata" aria-label={t("video")} className="mb-4 aspect-video w-full max-w-md rounded-xl bg-ink" />
            )}
          </section>

          <section aria-labelledby="reports-heading" className="mb-8">
            <h2 id="reports-heading" className="mb-3 text-xl">
              {t("reportsAbout")}
            </h2>
            {m.reportsAbout.length === 0 ? (
              <p className="text-ink-soft">{t("none")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {m.reportsAbout.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/reports/${r.id}`} className="text-covenant underline underline-offset-4">
                      {tReasons(r.reason)}{" · "}{tStatus(r.status)}{" · "}{date(r.createdAt)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="mb-3 text-xl">
              {t("history")}
            </h2>
            {m.actions.length === 0 ? (
              <p className="text-ink-soft">{t("none")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {m.actions.map((a) => (
                  <li key={a.id} className="rounded-xl border border-line px-4 py-2">
                    <span className="font-semibold">{tActions(a.action)}</span>
                    <span className="text-ink-soft">
                      {" · "}
                      {a.by}{" · "}{date(a.at)}
                    </span>
                    {a.note && <span className="block whitespace-pre-wrap text-[0.9375rem]">{a.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside aria-label={t("actions")} className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-xl">{t("actions")}</h2>
          {m.id === staff.id ? (
            <p className="text-ink-soft">{t("yourself")}</p>
          ) : m.suspendedAt ? (
            <ActionForm action={reinstateMember} summary={t("reinstate")} button={t("reinstate")} hidden={{ userId: m.id }} noteLabel={t("note")} />
          ) : (
            <ActionForm action={suspendMember} summary={t("suspend")} button={t("suspend")} hidden={{ userId: m.id }} noteLabel={t("note")} danger />
          )}
          {m.hasPhoto && remove("photo", t("removePhoto"))}
          {m.extraPhotos.map((p, i) => (
            <div key={p.id}>{remove("extra_photo", t("removeExtra", { n: i + 1 }), { photoId: p.id })}</div>
          ))}
          {m.videoUrl && remove("video", t("removeVideo"))}
          {m.aboutMe && remove("about", t("clearAbout"))}
          {m.promptCount > 0 && remove("prompts", t("clearPrompts"))}
          <p className="text-[0.875rem] text-ink-soft">{t("noticeSent")}</p>
        </aside>
      </div>
    </>
  );
}
