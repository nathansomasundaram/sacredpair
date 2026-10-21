import Link from "next/link";
import { Search } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { searchMembers } from "@/lib/admin/data";
import { requireStaff } from "@/lib/admin/staff";

export default async function MembersPage({ searchParams }: PageProps<"/admin/members">) {
  await requireStaff();
  const t = await getTranslations("admin.members");
  const format = await getFormatter();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.slice(0, 100) : "";
  const results = await searchMembers(q);
  return (
    <>
      <h1 className="mb-4 text-2xl sm:text-3xl">{t("title")}</h1>
      <form role="search" className="mb-6 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">
          {t("search")}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("placeholder")}
          className="min-h-12 flex-1 rounded-full border border-line bg-paper px-4"
        />
        <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-covenant px-5 font-semibold text-on-covenant">
          <Search aria-hidden size={18} />
          {t("search")}
        </button>
      </form>
      <p className="mb-3 text-[0.9375rem] text-ink-soft">{q ? t("results", { count: results.length }) : t("newest")}</p>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[40rem] text-start text-[0.9375rem]">
          <thead className="bg-mist/60 text-start">
            <tr>
              {["name", "email", "place", "joined", "status"].map((h) => (
                <th key={h} scope="col" className="px-4 py-2 text-start font-semibold">
                  {t(`cols.${h}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {results.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2">
                  <Link href={`/admin/members/${m.id}`} className="font-semibold text-covenant underline underline-offset-4">
                    {m.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{m.email}</td>
                <td className="px-4 py-2">{m.place}</td>
                <td className="px-4 py-2">{format.dateTime(new Date(m.joined), { dateStyle: "medium" })}</td>
                <td className="px-4 py-2">
                  <span className="flex flex-wrap gap-1">
                    {m.suspended && <span className="rounded-full bg-danger/10 px-2 text-danger">{t("suspended")}</span>}
                    {!m.verified && <span className="rounded-full bg-ring/15 px-2">{t("unverified")}</span>}
                    {m.openReports > 0 && <span className="rounded-full bg-danger/10 px-2 text-danger">{t("reports", { count: m.openReports })}</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
