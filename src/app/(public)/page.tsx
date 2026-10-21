import Link from "next/link";
import { BadgeCheck, Ban, Crown, EyeOff, HeartHandshake, IdCard, Lock, MessageCircle, Sprout, WandSparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PairMark } from "@/components/brand/PairMark";
import { FormAlert } from "@/components/forms/FormAlert";
import { StoryCard } from "@/components/site/StoryCard";
import { Scene } from "@/components/together/Scene";
import { primaryButtonClass, quietButtonClass } from "@/components/ui/buttonStyles";
import { getSessionUser } from "@/lib/auth/session";
import { loadPath, PATHS } from "@/lib/journey/content";
import { getPublishedStories } from "@/lib/site/stories";

const STEPS = [
  { key: "verify", icon: IdCard },
  { key: "four", icon: WandSparkles },
  { key: "choose", icon: HeartHandshake },
  { key: "together", icon: Sprout },
] as const;

const SAFETY = [
  { key: "verified", icon: BadgeCheck },
  { key: "private", icon: EyeOff },
  { key: "noStrangers", icon: MessageCircle },
  { key: "report", icon: Ban },
] as const;

/** The public home page. */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const t = await getTranslations("site.home");
  const tLanding = await getTranslations("landing");
  const locale = await getLocale();
  const [user, { notice }, stories, paths] = await Promise.all([
    getSessionUser(),
    searchParams,
    getPublishedStories(3),
    Promise.all(PATHS.map((p) => loadPath(p, locale))),
  ]);

  const cta = user ? (
    <Link href="/discover" className={primaryButtonClass}>
      {tLanding("openApp")}
    </Link>
  ) : (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/signup" className={primaryButtonClass}>
        {tLanding("createAccount")}
      </Link>
      <Link href="/login" className={quietButtonClass}>
        {tLanding("logIn")}
      </Link>
    </div>
  );

  return (
    <>
      {notice === "accountDeleted" && (
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <FormAlert tone="success">{tLanding("accountDeleted")}</FormAlert>
        </div>
      )}

      <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-20">
        <div className="flex flex-col items-start gap-6">
          <h1 className="text-[2.5rem] leading-[1.08] md:text-[3.25rem]">{tLanding("title")}</h1>
          <p className="max-w-[52ch] text-lg text-ink-soft">{tLanding("body")}</p>
          {cta}
          <p className="flex items-center gap-2 text-[0.9375rem] text-ink-soft">
            <Lock aria-hidden size={16} />
            {t("heroNote")}
          </p>
        </div>
        <div aria-hidden className="relative mx-auto grid w-full max-w-sm place-items-center">
          <div className="absolute inset-6 rounded-full bg-ring/15 blur-2xl" />
          <PairMark size={260} />
        </div>
      </section>

      <section aria-labelledby="how-heading" className="bg-mist/50 py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 id="how-heading" className="mb-8 text-2xl sm:text-3xl">
            {t("howTitle")}
          </h2>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ key, icon: Icon }, i) => (
              <li key={key} className="flex flex-col gap-3">
                <span className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-paper text-covenant">
                    <Icon aria-hidden size={21} />
                  </span>
                  <span className="text-[0.8125rem] font-semibold uppercase tracking-wide text-ink-soft">
                    {t("step", { n: i + 1 })}
                  </span>
                </span>
                <h3 className="text-xl">{t(`steps.${key}.title`)}</h3>
                <p className="text-ink-soft">{t(`steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="together-heading" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 id="together-heading" className="mb-2 text-2xl sm:text-3xl">
          {t("togetherTitle")}
        </h2>
        <p className="mb-8 max-w-[60ch] text-lg text-ink-soft">{t("togetherBody")}</p>
        <ul className="grid gap-5 sm:grid-cols-3">
          {paths.map((p) => (
            <li key={p.path} className="overflow-hidden rounded-2xl border border-line bg-paper">
              <Scene path={p.path} stage={9} label={p.name} />
              <div className="flex flex-col gap-1 p-4">
                <h3 className="text-xl">{p.name}</h3>
                <p className="text-ink-soft">{p.tagline}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="safety-heading" className="bg-mist/50 py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 id="safety-heading" className="mb-8 text-2xl sm:text-3xl">
            {t("safetyTitle")}
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2">
            {SAFETY.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-paper text-covenant">
                  <Icon aria-hidden size={21} />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-semibold">{t(`safety.${key}.title`)}</span>
                  <span className="text-ink-soft">{t(`safety.${key}.body`)}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link href="/tips" className="mt-8 inline-flex font-semibold text-covenant underline underline-offset-4">
            {t("safetyLink")}
          </Link>
        </div>
      </section>

      {stories.length > 0 && (
        <section aria-labelledby="stories-heading" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 id="stories-heading" className="mb-8 text-2xl sm:text-3xl">
            {t("storiesTitle")}
          </h2>
          <ul
            className={
              stories.length === 1
                ? "max-w-2xl"
                : `grid gap-5 ${stories.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`
            }
          >
            {stories.map((s) => (
              <li key={s.id}>
                <StoryCard story={s} />
              </li>
            ))}
          </ul>
          <Link href="/stories" className="mt-6 inline-flex font-semibold text-covenant underline underline-offset-4">
            {t("storiesLink")}
          </Link>
        </section>
      )}

      <section aria-labelledby="price-heading" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 id="price-heading" className="mb-8 text-2xl sm:text-3xl">
          {t("priceTitle")}
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-line p-6">
            <h3 className="text-xl">{t("free.title")}</h3>
            <ul className="flex list-disc flex-col gap-1.5 ps-5 text-ink-soft">
              {["a", "b", "c", "d"].map((k) => (
                <li key={k}>{t(`free.${k}`)}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-ring/60 bg-ring/10 p-6">
            <h3 className="flex items-center gap-2 text-xl">
              <Crown aria-hidden size={20} className="text-ring" />
              {t("premium.title")}
            </h3>
            <ul className="flex list-disc flex-col gap-1.5 ps-5 text-ink-soft">
              {["a", "b", "c", "d"].map((k) => (
                <li key={k}>{t(`premium.${k}`)}</li>
              ))}
            </ul>
            <p className="mt-auto text-[0.9375rem] text-ink-soft">{t("premium.note")}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-4 pb-6 sm:px-6">
        <h2 className="text-2xl sm:text-3xl">{t("finalTitle")}</h2>
        <p className="text-ink-soft">
          {t("finalBody")}{" "}
          <Link href="/faq" className="font-semibold text-covenant underline underline-offset-4">
            {t("faqLink")}
          </Link>
        </p>
        {cta}
      </section>
    </>
  );
}
