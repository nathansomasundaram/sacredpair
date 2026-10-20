import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  DeleteSection,
  EmailSection,
  PasswordSection,
  PhoneSection,
} from "@/components/settings/AccountForms";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import { smsAvailable } from "@/lib/notify/providers";
import { getSettings } from "@/lib/settings/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const t = await getTranslations("settings.account");
  const user = await requireVerifiedMember("/settings/account");
  const settings = await getSettings(user.id);
  return (
    <div className="flex max-w-xl flex-col gap-10">
      <div>
        <SettingsHeader title={t("title")} intro={t("intro")} />
      </div>
      <EmailSection email={user.email ?? ""} />
      <PhoneSection
        phone={settings.phone}
        verified={settings.phoneVerified}
        smsAvailable={smsAvailable()}
      />
      <PasswordSection />
      <DeleteSection />
    </div>
  );
}
