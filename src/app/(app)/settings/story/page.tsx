import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { StoryForm } from "@/components/settings/StoryForm";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getOwnProfile } from "@/lib/profile/data";
import { withdrawStory } from "@/lib/stories/actions";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.story");
  return { title: t("title") };
}

/** Members share how they met; the team reviews before anything is published. */
export default async function StoryPage() {
  const t = await getTranslations("settings.story");
  const format = await getFormatter();
  const user = await requireVerifiedMember("/settings/story");
  const supabase = await createClient();
  const [profile, { data: mine }] = await Promise.all([
    getOwnProfile(user.id),
    supabase.from("stories").select("id, body, status, created_at").eq("author_id", user.id).order("created_at", { ascending: false }),
  ]);
  const place = [profile.city, profile.stateCode].filter(Boolean).join(", ");

  return (
    <div className="max-w-xl">
      <SettingsHeader title={t("title")} intro={t("intro")} />
      <StoryForm defaultName={profile.displayName.split(" ")[0] ?? ""} defaultPlace={place} />

      {(mine?.length ?? 0) > 0 && (
        <section aria-labelledby="mine-heading" className="mt-12">
          <h2 id="mine-heading" className="mb-4 text-xl">
            {t("mineHeading")}
          </h2>
          <ul className="flex flex-col gap-3">
            {mine!.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 rounded-2xl border border-line p-4">
                <p className="line-clamp-3">{s.body}</p>
                <p className="text-[0.9375rem] text-ink-soft">
                  {t(`status.${s.status as "pending" | "approved" | "rejected"}`)}{" · "}
                  {format.dateTime(new Date(s.created_at), { dateStyle: "medium" })}
                </p>
                <form action={withdrawStory}>
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton variant="quiet">{s.status === "approved" ? t("takeDown") : t("withdraw")}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
