import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PairMark } from "@/components/brand/PairMark";
import { Wordmark } from "@/components/brand/Wordmark";

/**
 * Frame for sign up, log in and password pages. Phones: the form alone.
 * Desktop: the form beside a quiet panel saying how Sacred Pair works.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("auth.aside");
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:py-10">
        <header>
          <Link href="/" className="inline-block">
            <Wordmark size={26} />
          </Link>
        </header>
        <main
          id="main"
          className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-10"
        >
          {children}
        </main>
      </div>

      <aside className="relative hidden overflow-hidden bg-mist lg:flex lg:flex-col lg:justify-end lg:p-14">
        <PairMark
          woven={false}
          size={520}
          className="pointer-events-none absolute -end-28 -top-20 opacity-[0.13]"
        />
        <div className="relative max-w-[30rem]">
          <p className="font-display text-3xl leading-[1.15] text-ink">
            {t("title")}
          </p>
          <p className="mt-5 max-w-[42ch] text-lg text-ink-soft">{t("body")}</p>
        </div>
      </aside>
    </div>
  );
}
