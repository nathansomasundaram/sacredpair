import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { usesImperial } from "@/i18n/config";
import { PreferencesForm } from "@/components/settings/PreferencesForm";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getMembership } from "@/lib/premium/data";
import { getSettings } from "@/lib/settings/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.preferences");
  return { title: t("title") };
}

/** Who to meet: the basics for everyone, filters for Premium members. */
export default async function PreferencesPage() {
  const t = await getTranslations("settings.preferences");
  const user = await requireVerifiedMember("/settings/preferences");
  const [settings, membership] = await Promise.all([
    getSettings(user.id),
    getMembership(user.id),
  ]);
  return (
    <div className="max-w-xl">
      <SettingsHeader title={t("title")} intro={t("intro")} />
      <PreferencesForm
        settings={settings}
        premium={membership.premium}
        imperial={usesImperial(await getLocale())}
      />
    </div>
  );
}
