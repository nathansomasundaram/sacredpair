"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { tabs } from "./tabs";

/**
 * The five main tabs. A bottom bar on phones, a side rail from tablet width
 * up. The active tab is marked with a small gold ring, echoing the logo.
 */
export function TabNav({
  variant,
  unread = 0,
}: {
  variant: "bar" | "rail";
  unread?: number;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")}>
      <ul
        className={
          variant === "bar" ? "grid grid-cols-5" : "flex flex-col gap-1"
        }
      >
        {tabs.map(({ key, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative flex items-center rounded-lg transition-colors",
                  variant === "bar"
                    ? "min-h-16 flex-col justify-center gap-1 px-1 text-[0.8125rem]"
                    : "min-h-12 gap-3 px-3 text-base",
                  active
                    ? "font-semibold text-covenant"
                    : "text-ink-soft hover:bg-mist hover:text-ink",
                ].join(" ")}
              >
                <span className="relative">
                  <Icon
                    aria-hidden
                    size={24}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  {key === "chat" && unread > 0 ? (
                    <span
                      aria-hidden
                      className="absolute -end-2.5 -top-1.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-covenant px-1 text-[0.6875rem] font-semibold leading-none text-on-covenant"
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : (
                    active && (
                      <span
                        aria-hidden
                        className="absolute -end-1.5 -top-1 size-2.5 rounded-full border-2 border-ring bg-paper"
                      />
                    )
                  )}
                </span>
                <span>{t(key)}</span>
                {key === "chat" && unread > 0 && (
                  <span className="sr-only">
                    {t("unread", { count: unread })}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
