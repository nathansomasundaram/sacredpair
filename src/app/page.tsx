import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PairMark } from "@/components/brand/PairMark";
import {
  primaryButtonClass,
  quietButtonClass,
} from "@/components/forms/SubmitButton";
import { getSessionUser } from "@/lib/auth/session";

// Temporary front door. The full public home page (FAQ, testimonials,
// dating tips) is built in its own step.
export default async function HomePage() {
  const t = await getTranslations();
  const user = await getSessionUser();

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16"
    >
      <PairMark size={88} title={t("app.name")} />
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl md:text-[3.25rem] md:leading-[1.08]">
          {t("landing.title")}
        </h1>
        <p className="max-w-[60ch] text-lg text-ink-soft">
          {t("landing.body")}
        </p>
      </div>
      {user ? (
        <div>
          <Link href="/discover" className={primaryButtonClass}>
            {t("landing.openApp")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/signup" className={primaryButtonClass}>
            {t("landing.createAccount")}
          </Link>
          <Link href="/login" className={quietButtonClass}>
            {t("landing.logIn")}
          </Link>
        </div>
      )}
    </main>
  );
}
