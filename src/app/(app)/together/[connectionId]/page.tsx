import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Check,
  ChevronLeft,
  MessageCircle,
  PartyPopper,
  X,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { PremiumGate } from "@/components/premium/PremiumGate";
import { JourneyMap } from "@/components/together/JourneyMap";
import { PathChooser } from "@/components/together/PathChooser";
import { Scene } from "@/components/together/Scene";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { requireVerifiedMember } from "@/lib/auth/session";
import { acceptPath, closePath } from "@/lib/journey/actions";
import {
  LEVEL_COUNT,
  loadLevels,
  loadPath,
  PATHS,
} from "@/lib/journey/content";
import { getCouple } from "@/lib/journey/data";
import { levelStates, sharedStage } from "@/lib/journey/progress";
import { accessFor } from "@/lib/premium/access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTICES = [
  "proposed",
  "accepted",
  "withdrawn",
  "declined",
  "left",
  "alreadyOpen",
  "failed",
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("together");
  return { title: t("title") };
}

/** One couple's journey: choose a path, or follow it level by level. */
export default async function JourneyPage({
  params,
  searchParams,
}: PageProps<"/together/[connectionId]">) {
  const { connectionId } = await params;
  const user = await requireVerifiedMember(`/together/${connectionId}`);
  if (!UUID.test(connectionId)) notFound();
  const t = await getTranslations("together");
  const locale = await getLocale();
  const [couple, access, { notice }] = await Promise.all([
    getCouple(user.id, connectionId),
    accessFor(connectionId),
    searchParams,
  ]);
  if (!couple) notFound();
  const name = couple.other.displayName;
  const j = couple.journey;

  const hidden = (reason?: string) => (
    <>
      <input type="hidden" name="connectionId" value={connectionId} />
      {j && <input type="hidden" name="journeyId" value={j.id} />}
      {reason && <input type="hidden" name="reason" value={reason} />}
    </>
  );

  const header = (
    <>
      <Link
        href="/together"
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant"
      >
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {t("title")}
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl">{t("youAnd", { name })}</h1>
        <Link href={`/chat/${connectionId}`} className={quietButtonClass}>
          <MessageCircle aria-hidden size={17} />
          {t("chat")}
        </Link>
      </div>
      {typeof notice === "string" && NOTICES.includes(notice) && (
        <div className="mb-6">
          <FormAlert
            tone={
              notice === "failed" || notice === "alreadyOpen"
                ? "error"
                : "success"
            }
          >
            {t(`notice.${notice}`, { name })}
          </FormAlert>
        </div>
      )}
    </>
  );

  // Together needs Premium for both; any progress is kept meanwhile.
  if (access !== "open") {
    return (
      <>
        {header}
        <PremiumGate
          feature="together"
          access={access}
          name={name}
          next={`/together/${connectionId}`}
        />
      </>
    );
  }

  // No path yet: choose one.
  if (!j) {
    const paths = await Promise.all(
      PATHS.map(async (p) => ({
        info: await loadPath(p, locale),
        levels: await loadLevels(p, locale),
      })),
    );
    return (
      <>
        {header}
        <PathChooser connectionId={connectionId} name={name} paths={paths} />
      </>
    );
  }

  const info = await loadPath(j.path, locale);

  // A path has been suggested and is waiting for an answer.
  if (!j.accepted) {
    return (
      <>
        {header}
        <section className="grid max-w-2xl gap-5 overflow-hidden rounded-2xl border border-line sm:grid-cols-[14rem_1fr]">
          <Scene
            path={j.path}
            stage={9}
            label={t("finishedScene", { path: info.name })}
          />
          <div className="flex flex-col gap-3 p-5 sm:ps-0">
            <h2 className="text-xl">
              {j.proposedByMe
                ? t("youSuggested", { path: info.name })
                : t("theySuggested", { name, path: info.name })}
            </h2>
            <p className="text-ink-soft">{info.description}</p>
            {j.proposedByMe ? (
              <>
                <p className="font-semibold">{t("waitingFor", { name })}</p>
                <form action={closePath}>
                  {hidden("withdrawn")}
                  <SubmitButton variant="quiet">
                    <X aria-hidden size={17} />
                    {t("withdraw")}
                  </SubmitButton>
                </form>
              </>
            ) : (
              <div className="flex flex-wrap gap-3">
                <form action={acceptPath}>
                  {hidden()}
                  <SubmitButton>
                    <Check aria-hidden size={18} />
                    {t("accept", { path: info.name })}
                  </SubmitButton>
                </form>
                <form action={closePath}>
                  {hidden("declined")}
                  <SubmitButton variant="quiet">
                    {t("suggestOther")}
                  </SubmitButton>
                </form>
              </div>
            )}
          </div>
        </section>
      </>
    );
  }

  // On the path.
  const levels = await loadLevels(j.path, locale);
  const states = levelStates(couple.mine, couple.theirs);
  const together = sharedStage(couple.mine, couple.theirs);
  const stage = together === 0 ? info.start : levels[together - 1].stage;
  const finished = together === LEVEL_COUNT;
  const partnerLine =
    couple.mine > couple.theirs
      ? t("partner.behind", { name, level: couple.theirs + 1 })
      : couple.theirs > couple.mine
        ? t("partner.ahead", { name, level: couple.theirs })
        : together > 0 && !finished
          ? t("partner.even", { name })
          : null;

  return (
    <>
      {header}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start">
        <section
          aria-labelledby="stage-heading"
          className="overflow-hidden rounded-2xl border border-line bg-paper lg:sticky lg:top-10"
        >
          <Scene path={j.path} stage={together} label={stage.description} />
          <div className="flex flex-col gap-2 p-4">
            <span className="self-start rounded-full bg-leaf/15 px-2.5 py-0.5 text-[0.8125rem] font-semibold text-ink">
              {info.name}
            </span>
            <h2 id="stage-heading" className="text-xl">
              {stage.name}
            </h2>
            <p className="text-[0.9375rem] text-ink-soft">
              {stage.description}
            </p>
            <div
              role="progressbar"
              aria-label={t("progressLabel")}
              aria-valuemin={0}
              aria-valuemax={LEVEL_COUNT}
              aria-valuenow={together}
              className="h-2 overflow-hidden rounded-full bg-mist"
            >
              <div
                className="h-full rounded-full bg-leaf"
                style={{ width: `${(together / LEVEL_COUNT) * 100}%` }}
              />
            </div>
            <p className="text-[0.875rem] font-semibold text-ink-soft">
              {t("progress", { done: together, total: LEVEL_COUNT })}
            </p>
            {partnerLine && <p className="text-[0.9375rem]">{partnerLine}</p>}
          </div>
        </section>

        <section aria-labelledby="levels-heading">
          {finished && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-ring/60 bg-ring/10 px-5 py-4">
              <PartyPopper
                aria-hidden
                size={22}
                className="mt-0.5 shrink-0 text-ring"
              />
              <div>
                <p className="font-semibold">
                  {t("finishedTitle", { path: info.name })}
                </p>
                <p className="text-ink-soft">{t("finishedBody", { name })}</p>
              </div>
            </div>
          )}
          <h2 id="levels-heading" className="mb-3 text-xl">
            {t("levelsHeading")}
          </h2>
          <JourneyMap
            connectionId={connectionId}
            levels={levels}
            states={states}
            name={name}
          />

          <details className="mt-10 max-w-md text-[0.9375rem]">
            <summary className="cursor-pointer text-ink-soft underline-offset-4 hover:underline">
              {t("leaveSummary")}
            </summary>
            <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl border border-line p-4">
              <p className="text-ink-soft">
                {t("leaveBody", { name, path: info.name })}
              </p>
              <form action={closePath}>
                {hidden("left")}
                <SubmitButton variant="quiet">
                  {t("leave", { path: info.name })}
                </SubmitButton>
              </form>
            </div>
          </details>
        </section>
      </div>
    </>
  );
}
