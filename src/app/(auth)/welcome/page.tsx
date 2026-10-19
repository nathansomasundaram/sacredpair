import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PairMark } from "@/components/brand/PairMark";
import { SignupSteps } from "@/components/auth/SignupSteps";
import { primaryButtonClass } from "@/components/ui/buttonStyles";
import { requireVerifiedMember } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("welcome");
  return { title: t("title") };
}

const next = ["next1", "next2", "next3"] as const;

// Sign-up confirmation: shown once email and ID are both verified.
export default async function WelcomePage() {
  await requireVerifiedMember("/welcome");
  const t = await getTranslations("welcome");
  return (
    <>
      <SignupSteps current="done" />
      <PairMark size={64} className="mb-8" />
      <h1 className="mb-4 text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="mb-10 text-lg">{t("body")}</p>

      <section aria-labelledby="whats-next" className="mb-10">
        <h2
          id="whats-next"
          className="mb-5 font-sans text-base font-semibold text-ink-soft"
        >
          {t("nextTitle")}
        </h2>
        <ol className="flex flex-col gap-6">
          {next.map((key, i) => (
            <li key={key} className="grid grid-cols-[2rem_1fr] gap-x-3">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-full bg-mist font-display text-lg text-covenant"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{t(`${key}Title`)}</p>
                <p className="text-ink-soft">{t(`${key}Body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Link href="/profile" className={`${primaryButtonClass} w-full`}>
        {t("continue")}
      </Link>
    </>
  );
}
