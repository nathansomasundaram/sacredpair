"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  quietButtonClass,
  primaryButtonClass,
} from "@/components/ui/buttonStyles";

/**
 * Shown when a page fails to render. Server errors arrive without details
 * (so nothing sensitive leaks); `digest` matches the full error in the
 * server log.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const t = useTranslations("errorPage");
  const digest =
    error instanceof Error && "digest" in error ? String(error.digest) : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-6 py-16"
    >
      <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="text-lg">{t("body")}</p>
      {digest && <p className="text-ink-soft">{t("reference", { digest })}</p>}
      {process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PUBLIC_SITE_URL?.includes("localhost") ? (
        <p className="text-[0.9375rem] text-ink-soft">{t("devHint")}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className={primaryButtonClass}
        >
          {t("retry")}
        </button>
        <Link href="/" className={quietButtonClass}>
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
