import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  EllipsisVertical,
  ShieldAlert,
  UserRound,
  UserRoundSearch,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Conversation } from "@/components/chat/Conversation";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getConversation } from "@/lib/chat/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

/** One conversation. Only the two members of the connection can open it. */
export default async function ConversationPage({
  params,
}: PageProps<"/chat/[connectionId]">) {
  const { connectionId } = await params;
  const user = await requireVerifiedMember(`/chat/${connectionId}`);
  if (!UUID.test(connectionId)) notFound();
  const t = await getTranslations("chat");
  const conversation = await getConversation(user.id, connectionId);
  if (!conversation) notFound();
  const { other } = conversation;

  return (
    // Fills the screen between the app's header and tab bar.
    <div className="-mb-[calc(5rem+env(safe-area-inset-bottom))] flex h-[calc(100dvh-3.5rem-1.5rem)] flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:-mb-10 md:h-[calc(100dvh-2.5rem)] md:pb-6">
      <header className="flex items-center gap-2 border-b border-line pb-3">
        <Link
          href="/chat"
          aria-label={t("back")}
          className="grid size-11 shrink-0 place-items-center rounded-full text-covenant hover:bg-mist"
        >
          <ChevronLeft aria-hidden size={22} className="rtl:-scale-x-100" />
        </Link>
        <Link
          href={`/details/${other.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 hover:bg-mist/60"
        >
          <span className="relative block size-10 shrink-0 overflow-hidden rounded-full bg-mist">
            {conversation.photoUrl ? (
              <Image
                src={conversation.photoUrl}
                alt=""
                fill
                sizes="40px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <span className="grid h-full place-items-center text-ink-soft">
                <UserRound aria-hidden size={20} />
              </span>
            )}
          </span>
          <h1 className="truncate text-xl">{other.displayName}</h1>
        </Link>
        <details className="relative">
          <summary
            aria-label={t("menu", { name: other.displayName })}
            className="grid size-11 cursor-pointer list-none place-items-center rounded-full text-ink-soft hover:bg-mist [&::-webkit-details-marker]:hidden"
          >
            <EllipsisVertical aria-hidden size={22} />
          </summary>
          <ul className="absolute end-0 top-12 z-20 flex w-60 flex-col rounded-2xl border border-line bg-paper p-1.5 shadow-[0_12px_32px_-12px_rgb(30_35_64/0.35)]">
            <li>
              <Link
                href={`/details/${other.id}`}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-mist"
              >
                <UserRoundSearch aria-hidden size={18} />
                {t("viewProfile")}
              </Link>
            </li>
            <li>
              <Link
                href={`/safety/${other.id}?c=${connectionId}`}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-danger hover:bg-mist"
              >
                <ShieldAlert aria-hidden size={18} />
                {t("safety")}
              </Link>
            </li>
          </ul>
        </details>
      </header>

      <Conversation
        connectionId={connectionId}
        me={user.id}
        otherName={other.displayName}
        initialMessages={conversation.messages}
        initialHasEarlier={conversation.hasEarlier}
        initialActive={conversation.active}
      />
    </div>
  );
}
