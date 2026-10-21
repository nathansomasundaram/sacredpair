import { getFormatter, getTranslations } from "next-intl/server";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { addStaff, removeStaff } from "@/lib/admin/actions";
import { listStaff } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/admin/staff";

export default async function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  const me = await requireAdmin();
  const t = await getTranslations("admin.staff");
  const tRoles = await getTranslations("admin.roles");
  const format = await getFormatter();
  const [staff, { done, error }] = await Promise.all([listStaff(), searchParams]);
  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="mb-6 text-ink-soft">{t("intro")}</p>
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
      <ul className="mb-10 flex flex-col gap-2">
        {staff.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3">
            <span className="me-auto">
              <span className="block font-semibold">{s.name}</span>
              <span className="block text-[0.9375rem] text-ink-soft">
                {s.email}{" · "}{tRoles(s.role)}{" · "}{t("since", { date: format.dateTime(new Date(s.since), { dateStyle: "medium" }) })}
              </span>
            </span>
            {s.id !== me.id && (
              <form action={removeStaff}>
                <input type="hidden" name="userId" value={s.id} />
                <SubmitButton variant="quiet">{t("remove")}</SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>
      <form action={addStaff} className="flex flex-col items-start gap-4 rounded-2xl border border-line p-5">
        <h2 className="text-xl">{t("addTitle")}</h2>
        <p className="text-[0.9375rem] text-ink-soft">{t("addHint")}</p>
        <label className="flex w-full flex-col gap-1.5">
          <span className="font-semibold">{t("email")}</span>
          <input name="email" type="email" required className="min-h-12 rounded-xl border border-line bg-paper px-3" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("role")}</span>
          <select name="role" className="min-h-12 rounded-xl border border-line bg-paper px-3">
            <option value="moderator">{tRoles("moderator")}</option>
            <option value="admin">{tRoles("admin")}</option>
          </select>
        </label>
        <SubmitButton>{t("add")}</SubmitButton>
      </form>
    </div>
  );
}
