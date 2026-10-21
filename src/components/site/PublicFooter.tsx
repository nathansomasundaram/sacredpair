import Link from "next/link";
import { useTranslations } from "next-intl";
import { PairMark } from "@/components/brand/PairMark";

const LINKS = [
  { href: "/tips", key: "tips" },
  { href: "/stories", key: "stories" },
  { href: "/faq", key: "faq" },
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
] as const;

export function PublicFooter() {
  const t = useTranslations("site.footer");
  const tNav = useTranslations("site.nav");
  return (
    <footer className="mt-16 border-t border-line bg-mist/40">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex max-w-xs flex-col gap-3">
          <PairMark size={36} />
          <p className="text-[0.9375rem] text-ink-soft">{t("tagline")}</p>
        </div>
        <nav aria-label={t("label")}>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
            {LINKS.map(({ href, key }) => (
              <li key={key}>
                <Link href={href} className="inline-flex min-h-10 items-center text-[0.9375rem] hover:underline">
                  {tNav(key)}
                </Link>
              </li>
            ))}
            <li>
              <a href="mailto:support@sacredpair.com" className="inline-flex min-h-10 items-center text-[0.9375rem] hover:underline">
                {t("contact")}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-5xl px-4 pb-8 text-[0.875rem] text-ink-soft sm:px-6">
        {t("copyright", { year: new Date().getFullYear() })}
      </p>
    </footer>
  );
}
