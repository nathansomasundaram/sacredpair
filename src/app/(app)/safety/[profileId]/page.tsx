import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ban, ChevronLeft, HeartOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { ReportForm } from "@/components/safety/ReportForm";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getConnectState } from "@/lib/connect/data";
import { getProfileOverview } from "@/lib/profile/data";
import { blockMember, endConnection } from "@/lib/safety/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("safety");
  return { title: t("title") };
}

/**
 * Report, block, or end a connection with someone. Reached from a
 * conversation's menu and from the bottom of every profile.
 */
export default async function SafetyPage({
  params,
  searchParams,
}: PageProps<"/safety/[profileId]">) {
  const { profileId } = await params;
  const user = await requireVerifiedMember(`/safety/${profileId}`);
  if (!UUID.test(profileId)) notFound();
  if (profileId === user.id) redirect("/profile");

  const t = await getTranslations("safety");
  const [profile, state, { c }] = await Promise.all([
    getProfileOverview(profileId),
    getConnectState(user.id, profileId),
    searchParams,
  ]);
  if (!profile) notFound();
  const name = profile.displayName;
  const fromChat = typeof c === "string" && UUID.test(c);
  const back = fromChat ? `/chat/${c}` : `/details/${profileId}`;

  const hidden = (
    <>
      <input type="hidden" name="profileId" value={profileId} />
      {fromChat && <input type="hidden" name="fromChat" value="1" />}
    </>
  );

  return (
    <div className="max-w-xl">
      <Link
        href={back}
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant"
      >
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {t("back")}
      </Link>
      <h1 className="mb-2 text-2xl md:text-3xl">{t("heading", { name })}</h1>
      <p className="mb-8 text-ink-soft">{t("intro", { name })}</p>

      <section aria-labelledby="report-heading" className="mb-10">
        <h2 id="report-heading" className="mb-1 text-xl">
          {t("reportHeading")}
        </h2>
        <p className="mb-5 text-ink-soft">{t("reportBody")}</p>
        <ReportForm profileId={profileId} name={name} fromChat={fromChat} />
      </section>

      <section
        aria-labelledby="block-heading"
        className="mb-10 border-t border-line pt-8"
      >
        <h2 id="block-heading" className="mb-1 text-xl">
          {t("blockHeading", { name })}
        </h2>
        <p className="mb-5 text-ink-soft">{t("blockBody", { name })}</p>
        <form action={blockMember}>
          {hidden}
          <SubmitButton
            variant="quiet"
            className="border-danger/50 text-danger hover:bg-danger/[0.07]"
          >
            <Ban aria-hidden size={18} />
            {t("block", { name })}
          </SubmitButton>
        </form>
      </section>

      {state.connection?.active && (
        <section
          aria-labelledby="end-heading"
          className="border-t border-line pt-8"
        >
          <h2 id="end-heading" className="mb-1 text-xl">
            {t("endHeading")}
          </h2>
          <p className="mb-5 text-ink-soft">{t("endBody", { name })}</p>
          <form action={endConnection}>
            {hidden}
            <SubmitButton variant="quiet">
              <HeartOff aria-hidden size={18} />
              {t("end", { name })}
            </SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}
