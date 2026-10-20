import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, UserRound } from "lucide-react";
import { getFormatter, getNow, getTranslations } from "next-intl/server";
import { LiveRefresh } from "@/components/chat/LiveRefresh";
import { FormAlert } from "@/components/forms/FormAlert";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getConversations } from "@/lib/chat/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

/** The Chat tab: one conversation per connection, most recent first. */
export default async function ChatPage({ searchParams }: PageProps<"/chat">) {
  const t = await getTranslations("chat");
  const tSafety = await getTranslations("safety");
  const format = await getFormatter();
  const now = await getNow();
  const user = await requireVerifiedMember("/chat");
  const [conversations, { notice }] = await Promise.all([
    getConversations(user.id),
    searchParams,
  ]);

  const alert =
    notice === "blocked" ||
    notice === "ended" ||
    notice === "reported" ||
    notice === "reportedBlocked" ? (
      <div className="mb-6">
        <FormAlert tone="success">{tSafety(`notice.${notice}`)}</FormAlert>
      </div>
    ) : null;

  if (conversations.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        {alert}
        <EmptyState
          icon={MessageCircle}
          title={t("emptyTitle")}
          body={t("emptyBody")}
        >
          <Link href="/details" className={quietButtonClass}>
            {t("seeProfiles")}
          </Link>
        </EmptyState>
        <LiveRefresh />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title")} />
      {alert}
      <ul aria-label={t("listLabel")} className="flex flex-col gap-2">
        {conversations.map((c) => (
          <li key={c.connectionId}>
            <Link
              href={`/chat/${c.connectionId}`}
              className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-3 transition-colors hover:bg-mist/60"
            >
              <span className="relative block size-14 shrink-0 overflow-hidden rounded-full bg-mist">
                {c.photoUrl ? (
                  <Image
                    src={c.photoUrl}
                    alt=""
                    fill
                    sizes="56px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-ink-soft">
                    <UserRound aria-hidden size={26} />
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline justify-between gap-3">
                  <span
                    className={`truncate font-display text-lg ${c.unread ? "font-semibold" : ""}`}
                  >
                    {c.other.displayName}
                  </span>
                  <span className="shrink-0 text-[0.8125rem] text-ink-soft">
                    {format.relativeTime(
                      new Date(c.last?.at ?? c.connectedAt),
                      now,
                    )}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-3">
                  <span
                    className={`truncate text-[0.9375rem] ${c.unread ? "font-semibold text-ink" : "text-ink-soft"}`}
                  >
                    {c.last
                      ? c.last.mine
                        ? t("youPrefix", { body: c.last.body })
                        : c.last.body
                      : t("newConnection")}
                  </span>
                  {c.unread > 0 && (
                    <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-covenant px-1.5 text-[0.8125rem] font-semibold text-on-covenant">
                      <span aria-hidden>{c.unread}</span>
                      <span className="sr-only">
                        {t("unread", { count: c.unread })}
                      </span>
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <LiveRefresh />
    </>
  );
}
