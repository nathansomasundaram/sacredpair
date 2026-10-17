import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PairMark } from "@/components/brand/PairMark";

// Temporary front door. The public home page (sign up, log in, FAQ,
// testimonials, dating tips) is built in its own step.
export default async function HomePage() {
  const t = await getTranslations();
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
      <div>
        <Link
          href="/discover"
          className="inline-flex min-h-12 items-center rounded-full bg-covenant px-6 font-semibold text-on-covenant transition-colors hover:bg-covenant-strong"
        >
          {t("landing.openApp")}
        </Link>
      </div>
    </main>
  );
}
