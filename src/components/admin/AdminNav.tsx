"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

const LINKS = [
  { href: "/admin", key: "overview" },
  { href: "/admin/reports", key: "reports" },
  { href: "/admin/members", key: "members" },
  { href: "/admin/stories", key: "stories" },
  { href: "/admin/log", key: "log" },
  { href: "/admin/coupons", key: "coupons" },
  { href: "/admin/staff", key: "staff" },
] as const;

// Only admins manage staff and pricing.
const ADMIN_ONLY: readonly string[] = ["staff", "coupons"];

export function AdminNav({ isAdmin, openReports, pendingStories }: { isAdmin: boolean; openReports: number; pendingStories: number }) {
  const t = useTranslations("admin.nav");
  const path = usePathname();
  const badge: Record<string, number> = { reports: openReports, stories: pendingStories };
  const navRef = useRef<HTMLElement>(null);
  // On narrow screens the tabs scroll sideways; keep the current one in view.
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current) return;
    const a = current.getBoundingClientRect();
    const b = nav.getBoundingClientRect();
    nav.scrollLeft += a.left - b.left - (b.width - a.width) / 2;
  }, [path]);
  return (
    <nav ref={navRef} aria-label={t("label")} className="overflow-x-auto">
      <ul className="flex gap-1">
        {LINKS.filter((l) => isAdmin || !ADMIN_ONLY.includes(l.key)).map(({ href, key }) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 font-semibold ${active ? "bg-covenant text-on-covenant" : "text-ink-soft hover:bg-mist"}`}
              >
                {t(key)}
                {(badge[key] ?? 0) > 0 && (
                  <span className={`rounded-full px-2 text-[0.8125rem] ${active ? "bg-paper/25" : "bg-danger text-paper"}`}>
                    {badge[key]}
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
