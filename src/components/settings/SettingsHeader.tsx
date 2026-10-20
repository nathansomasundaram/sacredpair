import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";

/** Back link and title for a Settings page. */
export function SettingsHeader({
  title,
  intro,
  back = "/settings",
}: {
  title: string;
  intro?: string;
  back?: string;
}) {
  const t = useTranslations("settings");
  return (
    <>
      <Link
        href={back}
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant"
      >
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {back === "/settings" ? t("title") : t("backToProfile")}
      </Link>
      <h1 className="mb-2 text-2xl md:text-3xl">{title}</h1>
      {intro && <p className="mb-8 max-w-prose text-ink-soft">{intro}</p>}
    </>
  );
}
