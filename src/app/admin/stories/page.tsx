import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { reviewStory } from "@/lib/admin/actions";
import { listStories, type StoryRow } from "@/lib/admin/data";
import { requireStaff } from "@/lib/admin/staff";

const STATUSES: StoryRow["status"][] = ["pending", "approved", "rejected"];

export default async function StoriesQueue({ searchParams }: PageProps<"/admin/stories">) {
  await requireStaff();
  const t = await getTranslations("admin.stories");
  const format = await getFormatter();
  const { status: raw, done } = await searchParams;
  const status = STATUSES.includes(raw as StoryRow["status"]) ? (raw as StoryRow["status"]) : "pending";
  const stories = await listStories(status);
  const button = (s: StoryRow, decision: "approve" | "reject" | "unpublish", variant: "primary" | "quiet") => (
    <form action={reviewStory}>
      <input type="hidden" name="storyId" value={s.id} />
      <input type="hidden" name="decision" value={decision} />
      <SubmitButton variant={variant}>{t(decision)}</SubmitButton>
    </form>
  );
  return (
    <>
      <h1 className="mb-2 text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="mb-4 max-w-prose text-ink-soft">{t("intro")}</p>
      {typeof done === "string" && (
        <div className="mb-4">
          <FormAlert tone="success">{t(`done.${done}`)}</FormAlert>
        </div>
      )}
      <nav aria-label={t("filter")} className="mb-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/stories?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-[0.9375rem] font-semibold ${s === status ? "border-covenant bg-covenant/10 text-covenant" : "border-line text-ink-soft hover:bg-mist"}`}
          >
            {t(`status.${s}`)}
          </Link>
        ))}
      </nav>
      {stories.length === 0 ? (
        <p className="text-ink-soft">{t("none")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {stories.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5">
              <blockquote className="whitespace-pre-wrap font-display text-lg leading-snug">{s.body}</blockquote>
              <p className="text-[0.9375rem] text-ink-soft">
                {t("shownAs", { name: [s.displayName, s.partnerName].filter(Boolean).join(" & "), place: s.place || "—" })}
                {" · "}
                {s.author ? (
                  <Link href={`/admin/members/${s.author.id}`} className="text-covenant underline underline-offset-4">
                    {s.author.email}
                  </Link>
                ) : (
                  "—"
                )}
                {" · "}
                {format.dateTime(new Date(s.createdAt), { dateStyle: "medium" })}
              </p>
              <div className="flex flex-wrap gap-2">
                {s.status === "pending" && (
                  <>
                    {button(s, "approve", "primary")}
                    {button(s, "reject", "quiet")}
                  </>
                )}
                {s.status === "approved" && button(s, "unpublish", "quiet")}
                {s.status === "rejected" && button(s, "approve", "quiet")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
