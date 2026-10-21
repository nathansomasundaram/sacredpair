import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Crown,
  Heart,
  LogOut,
  SlidersHorizontal,
  UserCog,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { logOut } from "@/lib/auth/actions";
import { requireVerifiedMember } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

const SECTIONS = [
  { key: "preferences", icon: SlidersHorizontal },
  { key: "notifications", icon: Bell },
  { key: "account", icon: UserCog },
  { key: "membership", icon: Crown },
  { key: "story", icon: Heart },
] as const;

/** Settings: reached from the Profile tab. */
export default async function SettingsPage() {
  const t = await getTranslations("settings");
  await requireVerifiedMember("/settings");
  return (
    <div className="max-w-xl">
      <SettingsHeader title={t("title")} back="/profile" />
      <ul className="mt-6 flex flex-col gap-2">
        {SECTIONS.map(({ key, icon: Icon }) => (
          <li key={key}>
            <Link
              href={`/settings/${key}`}
              className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-4 transition-colors hover:bg-mist/60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mist text-covenant">
                <Icon aria-hidden size={21} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">
                  {t(`sections.${key}.title`)}
                </span>
                <span className="text-[0.9375rem] text-ink-soft">
                  {t(`sections.${key}.body`)}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                size={18}
                className="shrink-0 text-covenant rtl:-scale-x-100"
              />
            </Link>
          </li>
        ))}
      </ul>
      <form action={logOut} className="mt-8">
        <SubmitButton variant="quiet">
          <LogOut aria-hidden size={18} />
          {t("logOut")}
        </SubmitButton>
      </form>
    </div>
  );
}
