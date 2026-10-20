import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotificationsForm } from "@/components/settings/NotificationsForm";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { smsAvailable } from "@/lib/notify/providers";
import { getSettings } from "@/lib/settings/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const t = await getTranslations("settings.notifications");
  const user = await requireVerifiedMember("/settings/notifications");
  const settings = await getSettings(user.id);
  return (
    <div className="max-w-xl">
      <SettingsHeader title={t("title")} intro={t("intro")} />
      <NotificationsForm
        settings={settings}
        email={user.email ?? ""}
        pushKey={publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        smsAvailable={smsAvailable()}
      />
    </div>
  );
}
