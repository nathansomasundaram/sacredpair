import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LessonPlayer } from "@/components/together/LessonPlayer";
import { requireVerifiedMember } from "@/lib/auth/session";
import { LEVEL_COUNT, loadLevel } from "@/lib/journey/content";
import { getCouple } from "@/lib/journey/data";
import { canPlay, levelStates } from "@/lib/journey/progress";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("together");
  return { title: t("title") };
}

/** One level of a couple's journey. */
export default async function LevelPage({
  params,
}: PageProps<"/together/[connectionId]/level/[level]">) {
  const { connectionId, level: raw } = await params;
  const user = await requireVerifiedMember(`/together/${connectionId}`);
  const level = Number(raw);
  if (
    !UUID.test(connectionId) ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > LEVEL_COUNT
  )
    notFound();

  const couple = await getCouple(user.id, connectionId);
  if (!couple) notFound();
  const j = couple.journey;
  if (!j?.accepted) redirect(`/together/${connectionId}`);
  const state = levelStates(couple.mine, couple.theirs)[level - 1];
  if (!canPlay(state)) redirect(`/together/${connectionId}`);

  const content = await loadLevel(j.path, level, await getLocale());
  return (
    <LessonPlayer
      connectionId={connectionId}
      journeyId={j.id}
      level={content}
      path={j.path}
      partnerName={couple.other.displayName}
      partnerDone={couple.theirs >= level}
      replay={couple.mine >= level}
      nextStage={content.stage}
    />
  );
}
