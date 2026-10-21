import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Sprout, UserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PremiumBanner } from "@/components/premium/PremiumGate";
import { Scene } from "@/components/together/Scene";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import { LEVEL_COUNT, loadPath } from "@/lib/journey/content";
import { getCouples } from "@/lib/journey/data";
import { sharedStage } from "@/lib/journey/progress";
import { getConnectionAccess } from "@/lib/premium/access";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("together");
  return { title: t("title") };
}

/** The Together tab: a journey for each connection. */
export default async function TogetherPage() {
  const t = await getTranslations("together");
  const tGate = await getTranslations("premiumGate");
  const locale = await getLocale();
  const user = await requireVerifiedMember("/together");
  const [couples, access] = await Promise.all([
    getCouples(user.id),
    getConnectionAccess(),
  ]);

  if (couples.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState icon={Sprout} title={t("emptyTitle")} body={t("emptyBody")}>
          <Link href="/details" className={quietButtonClass}>
            {t("seeProfiles")}
          </Link>
        </EmptyState>
      </>
    );
  }

  const paths = new Map(
    await Promise.all(
      [
        ...new Set(couples.flatMap((c) => (c.journey ? [c.journey.path] : []))),
      ].map(async (p) => [p, await loadPath(p, locale)] as const),
    ),
  );

  return (
    <>
      <PageHeader title={t("title")} />
      <p className="mb-5 max-w-prose text-ink-soft">{t("listIntro")}</p>
      {[...access.values()].includes("upgrade") && (
        <PremiumBanner feature="together" next="/together" />
      )}
      <ul className="flex flex-col gap-3">
        {couples.map((c) => {
          const name = c.other.displayName;
          const j = c.journey;
          const pathName = j ? paths.get(j.path)!.name : "";
          const together = sharedStage(c.mine, c.theirs);
          const gate = access.get(c.connectionId) ?? "open";
          const status =
            gate === "upgrade"
              ? tGate("lockedPreview")
              : gate === "waiting"
                ? tGate("waitingPreview", { name })
                : !j
                  ? t("status.choose")
                  : !j.accepted
                    ? j.proposedByMe
                      ? t("status.waiting", { name, path: pathName })
                      : t("status.suggested", { name, path: pathName })
                    : together === LEVEL_COUNT
                      ? t("status.complete", { path: pathName })
                      : t("status.progress", {
                          path: pathName,
                          done: together,
                          total: LEVEL_COUNT,
                        });
          return (
            <li key={c.connectionId}>
              <Link
                href={`/together/${c.connectionId}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-3 transition-colors hover:bg-mist/60"
              >
                <span className="relative block size-18 shrink-0 overflow-hidden rounded-xl bg-mist">
                  {j?.accepted ? (
                    <Scene path={j.path} stage={together} label="" />
                  ) : c.photoUrl ? (
                    <Image
                      src={c.photoUrl}
                      alt=""
                      fill
                      sizes="72px"
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid h-full place-items-center text-ink-soft">
                      <UserRound aria-hidden size={30} />
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-display text-lg leading-tight">
                    {t("youAnd", { name })}
                  </span>
                  <span
                    className={`text-[0.9375rem] ${j && !j.accepted && !j.proposedByMe ? "font-semibold text-covenant" : "text-ink-soft"}`}
                  >
                    {status}
                  </span>
                  {j?.accepted && (
                    <span
                      aria-hidden
                      className="h-1.5 overflow-hidden rounded-full bg-mist"
                    >
                      <span
                        className="block h-full rounded-full bg-leaf"
                        style={{ width: `${(together / LEVEL_COUNT) * 100}%` }}
                      />
                    </span>
                  )}
                </span>
                <ChevronRight
                  aria-hidden
                  size={18}
                  className="shrink-0 text-covenant rtl:-scale-x-100"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
