import Link from "next/link";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/Wordmark";
import { primaryButtonClass } from "@/components/ui/buttonStyles";

const LINKS = [
  { href: "/tips", key: "tips" },
  { href: "/stories", key: "stories" },
  { href: "/faq", key: "faq" },
] as const;

/** The public site's header: brand, a few links, and sign-in. */
export function PublicHeader({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("site.nav");
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="me-auto shrink-0 whitespace-nowrap">
          <Wordmark size={26} />
        </Link>
        <nav aria-label={t("label")} className="hidden sm:block">
          <ul className="flex items-center gap-1">
            {LINKS.map(({ href, key }) => (
              <li key={key}>
                <Link href={href} className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold text-ink-soft hover:bg-mist hover:text-ink">
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {signedIn ? (
          <Link href="/discover" className={`${primaryButtonClass} shrink-0 whitespace-nowrap`}>
            {t("openApp")}
          </Link>
        ) : (
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <Link href="/login" className="hidden min-h-11 items-center rounded-full px-3 font-semibold text-covenant hover:bg-mist sm:inline-flex">
              {t("logIn")}
            </Link>
            <Link href="/signup" className={`${primaryButtonClass} hidden whitespace-nowrap min-[340px]:inline-flex`}>
              {t("join")}
            </Link>
          </div>
        )}
        <details className="relative sm:hidden">
          <summary
            aria-label={t("menu")}
            className="grid size-11 cursor-pointer list-none place-items-center rounded-full hover:bg-mist [&::-webkit-details-marker]:hidden"
          >
            <Menu aria-hidden size={22} />
          </summary>
          <ul className="absolute end-0 top-12 z-20 flex w-52 flex-col rounded-2xl border border-line bg-paper p-1.5 shadow-[0_12px_32px_-12px_rgb(30_35_64/0.35)]">
            {LINKS.map(({ href, key }) => (
              <li key={key}>
                <Link href={href} className="flex min-h-11 items-center rounded-xl px-3 font-semibold hover:bg-mist">
                  {t(key)}
                </Link>
              </li>
            ))}
            {!signedIn && (
              <>
                <li>
                  <Link href="/login" className="flex min-h-11 items-center rounded-xl px-3 font-semibold text-covenant hover:bg-mist">
                    {t("logIn")}
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="flex min-h-11 items-center rounded-xl px-3 font-semibold text-covenant hover:bg-mist">
                    {t("join")}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </details>
      </div>
    </header>
  );
}
