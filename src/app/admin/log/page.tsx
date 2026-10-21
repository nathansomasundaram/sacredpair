import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { recentActions } from "@/lib/admin/data";
import { requireStaff } from "@/lib/admin/staff";

/** Every staff action, newest first. */
export default async function LogPage() {
  await requireStaff();
  const t = await getTranslations("admin.log");
  const tActions = await getTranslations("admin.actions");
  const format = await getFormatter();
  const actions = await recentActions();
  return (
    <>
      <h1 className="mb-2 text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="mb-6 max-w-prose text-ink-soft">{t("intro")}</p>
      {actions.length === 0 ? (
        <p className="text-ink-soft">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {actions.map((a) => (
            <li key={a.id} className="rounded-xl border border-line px-4 py-2">
              <span className="font-semibold">{tActions(a.action)}</span>
              {a.target && (
                <>
                  {" · "}
                  <Link href={`/admin/members/${a.target.id}`} className="text-covenant underline underline-offset-4">
                    {a.target.name}
                  </Link>
                </>
              )}
              <span className="text-ink-soft">
                {" · "}
                {t("by", { name: a.staff?.name ?? "—" })}{" · "}
                {format.dateTime(new Date(a.at), { dateStyle: "medium", timeStyle: "short" })}
              </span>
              {a.note && <span className="block whitespace-pre-wrap text-[0.9375rem]">{a.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
