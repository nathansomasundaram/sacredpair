"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, ArrowUp, LoaderCircle, RotateCw } from "lucide-react";
import {
  loadEarlier,
  markRead,
  sendMessage,
  syncConversation,
} from "@/lib/chat/actions";
import {
  MESSAGE_MAX,
  mergeMessages,
  toMessage,
  type ChatMessage,
  type MessageRow,
  type SendError,
} from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "./useHydrated";

type Pending = { key: number; body: string; error: SendError | null };

/** How often to check for new messages when live updates aren't available. */
const POLL_MS = 4000;

/**
 * A conversation between two connected members. New messages and read
 * receipts arrive live through Supabase Realtime, which applies the same
 * access rules as the database: only the two members receive anything. If
 * live updates can't connect (some networks block them), it checks every
 * few seconds instead.
 */
export function Conversation({
  connectionId,
  me,
  otherName,
  initialMessages,
  initialHasEarlier,
  initialActive,
}: {
  connectionId: string;
  me: string;
  otherName: string;
  initialMessages: ChatMessage[];
  initialHasEarlier: boolean;
  initialActive: boolean;
}) {
  const t = useTranslations("chat");
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [hasEarlier, setHasEarlier] = useState(initialHasEarlier);
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const nextKey = useRef(1);
  const lastMarked = useRef(0);

  const merge = useCallback((incoming: ChatMessage[]) => {
    setMessages((current) => mergeMessages(current, incoming));
  }, []);

  // Live updates, with a periodic check as the fallback.
  useEffect(() => {
    if (!active) return;
    const supabase = createClient();
    let cancelled = false;
    let live = false;
    let poll: number | undefined;

    const sync = async () => {
      try {
        const r = await syncConversation(connectionId);
        if (cancelled) return;
        if (!r.active) setActive(false);
        else merge(r.messages);
      } catch {
        // Offline for a moment: the next check will catch up.
      }
    };
    const startPolling = () => {
      if (poll === undefined) poll = window.setInterval(sync, POLL_MS);
    };
    const stopPolling = () => {
      if (poll !== undefined) window.clearInterval(poll);
      poll = undefined;
    };

    const filter = `connection_id=eq.${connectionId}`;
    const channel = supabase
      .channel(`chat:${connectionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        (p) => merge([toMessage(p.new as MessageRow)]),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter },
        (p) => merge([toMessage(p.new as MessageRow)]),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "connections",
          filter: `id=eq.${connectionId}`,
        },
        (p) => {
          if ((p.new as { ended_at: string | null }).ended_at) setActive(false);
        },
      );

    (async () => {
      try {
        await supabase.realtime.setAuth();
      } catch {
        // Falls back to checking periodically.
      }
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          live = true;
          stopPolling();
          void sync(); // catch anything sent while connecting
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          live = false;
          startPolling();
        }
      });
    })();

    const fallback = window.setTimeout(() => {
      if (!live) startPolling();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      stopPolling();
      window.clearTimeout(fallback);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [active, connectionId, merge]);

  // Read receipts: mark the other person's messages read while the
  // conversation is on screen.
  useEffect(() => {
    if (!active) return;
    const newestUnread = messages.findLast(
      (m) => m.senderId !== me && !m.readAt,
    );
    if (!newestUnread || newestUnread.id <= lastMarked.current) return;
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      lastMarked.current = newestUnread.id;
      void markRead(connectionId).then(() => router.refresh());
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [messages, me, active, connectionId, router]);

  // Keep the newest message in view unless the member scrolled up to read.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const onScroll = () => {
    const el = listRef.current;
    if (el)
      stickToBottom.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  async function deliver(item: Pending) {
    const r = await sendMessage(connectionId, item.body);
    if (r.ok) {
      setPending((p) => p.filter((x) => x.key !== item.key));
      merge([r.message]);
    } else {
      if (r.error === "closed") setActive(false);
      setPending((p) =>
        p.map((x) => (x.key === item.key ? { ...x, error: r.error } : x)),
      );
    }
  }

  function send() {
    const body = draft.trim();
    if (!body || body.length > MESSAGE_MAX) return;
    const item = { key: nextKey.current++, body, error: null };
    stickToBottom.current = true;
    setPending((p) => [...p, item]);
    setDraft("");
    void deliver(item);
  }

  function retry(item: Pending) {
    const again = { ...item, error: null };
    setPending((p) => p.map((x) => (x.key === item.key ? again : x)));
    void deliver(again);
  }

  async function showEarlier() {
    const first = messages[0];
    if (!first) return;
    setLoadingEarlier(true);
    const el = listRef.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    stickToBottom.current = false;
    try {
      const r = await loadEarlier(connectionId, first.id);
      merge(r.messages);
      setHasEarlier(r.hasEarlier);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before;
      });
    } finally {
      setLoadingEarlier(false);
    }
  }

  const lastMine = messages.findLast((m) => m.senderId === me);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        onScroll={onScroll}
        role="log"
        aria-label={t("messagesLabel", { name: otherName })}
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4"
      >
        {hasEarlier && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={showEarlier}
              disabled={loadingEarlier}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-[0.9375rem] font-semibold text-covenant hover:bg-mist"
            >
              {loadingEarlier && (
                <LoaderCircle aria-hidden size={16} className="animate-spin" />
              )}
              {t("showEarlier")}
            </button>
          </div>
        )}

        {messages.length === 0 && pending.length === 0 && active && (
          <p className="mx-auto max-w-sm px-4 py-10 text-center text-ink-soft">
            {t("sayHello", { name: otherName })}
          </p>
        )}

        <MessageList
          messages={messages}
          me={me}
          lastMineId={lastMine?.id ?? null}
        />

        {pending.length > 0 && (
          <ul className="mt-1 flex flex-col items-end gap-1">
            {pending.map((p) => (
              <li
                key={p.key}
                className="flex max-w-[85%] flex-col items-end gap-1"
              >
                <p
                  className={`whitespace-pre-wrap break-words rounded-2xl rounded-ee-md px-4 py-2.5 ${
                    p.error
                      ? "bg-danger/10 text-ink"
                      : "bg-covenant/80 text-on-covenant"
                  }`}
                >
                  {p.body}
                </p>
                {p.error ? (
                  <span
                    role="alert"
                    className="flex items-center gap-2 text-[0.875rem] text-danger"
                  >
                    <AlertCircle aria-hidden size={15} />
                    {t(`sendError.${p.error}`)}
                    {p.error !== "closed" && p.error !== "premium" && (
                      <button
                        type="button"
                        onClick={() => retry(p)}
                        className="inline-flex items-center gap-1 font-semibold text-covenant underline"
                      >
                        <RotateCw aria-hidden size={14} />
                        {t("retry")}
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="text-[0.8125rem] text-ink-soft">
                    {t("sending")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {active ? (
        <Composer
          draft={draft}
          setDraft={setDraft}
          onSend={send}
          name={otherName}
        />
      ) : (
        <p
          role="status"
          className="rounded-2xl bg-mist px-4 py-3 text-center text-ink-soft"
        >
          {t("ended")}
        </p>
      )}
    </div>
  );
}

function MessageList({
  messages,
  me,
  lastMineId,
}: {
  messages: ChatMessage[];
  me: string;
  lastMineId: number | null;
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const hydrated = useHydrated();
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  const day = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const dayKey = (iso: string) => new Date(iso).toDateString();
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);

  const label = (iso: string) => {
    const k = dayKey(iso);
    if (k === today.toDateString()) return t("today");
    if (k === yesterday.toDateString()) return t("yesterday");
    return day.format(new Date(iso));
  };

  return (
    <ol className="flex flex-col gap-1">
      {messages.map((m, i) => {
        const mine = m.senderId === me;
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const newDay =
          hydrated && (!prev || dayKey(prev.createdAt) !== dayKey(m.createdAt));
        const lastInRun =
          !next ||
          next.senderId !== m.senderId ||
          new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() >
            5 * 60_000;
        return (
          <li key={m.id} className="flex flex-col">
            {newDay && (
              <p className="my-3 text-center text-[0.8125rem] font-semibold text-ink-soft">
                {label(m.createdAt)}
              </p>
            )}
            <div
              className={`flex max-w-[85%] flex-col gap-1 ${mine ? "items-end self-end" : "items-start self-start"}`}
            >
              <p
                className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 ${
                  mine
                    ? `bg-covenant text-on-covenant ${lastInRun ? "rounded-ee-md" : ""}`
                    : `bg-mist text-ink ${lastInRun ? "rounded-es-md" : ""}`
                }`}
              >
                <span className="sr-only">
                  {mine ? t("youSaid") : t("theySaid")}
                </span>
                {m.body}
              </p>
              {(lastInRun || m.id === lastMineId) && hydrated && (
                <span className="mb-2 text-[0.8125rem] text-ink-soft">
                  {time.format(new Date(m.createdAt))}
                  {m.id === lastMineId &&
                    (m.readAt ? ` · ${t("read")}` : ` · ${t("sent")}`)}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Composer({
  draft,
  setDraft,
  onSend,
  name,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  name: string;
}) {
  const t = useTranslations("chat");
  const ref = useRef<HTMLTextAreaElement>(null);
  const tooLong = draft.length > MESSAGE_MAX;
  const nearLimit = draft.length > MESSAGE_MAX - 200;

  // Grow with the text, up to about five lines.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
        ref.current?.focus();
      }}
      className="flex flex-col gap-1 border-t border-line pt-3"
    >
      <div className="flex items-end gap-2">
        <label htmlFor="message" className="sr-only">
          {t("messageLabel", { name })}
        </label>
        <textarea
          ref={ref}
          id="message"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a keyboard; on phones Enter adds a new line.
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              window.matchMedia("(pointer: fine)").matches
            ) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={t("placeholder")}
          aria-invalid={tooLong || undefined}
          aria-describedby={nearLimit ? "message-count" : undefined}
          className="min-h-12 flex-1 resize-none rounded-3xl border border-line bg-paper px-4 py-3 leading-snug text-ink placeholder:text-ink-soft/80 focus:border-covenant focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || tooLong}
          aria-label={t("send")}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-covenant text-on-covenant transition-colors hover:bg-covenant-strong disabled:opacity-40"
        >
          <ArrowUp aria-hidden size={22} />
        </button>
      </div>
      {nearLimit && (
        <p
          id="message-count"
          className={`ps-4 text-[0.8125rem] ${tooLong ? "text-danger" : "text-ink-soft"}`}
        >
          {t("count", { count: draft.length, max: MESSAGE_MAX })}
        </p>
      )}
    </form>
  );
}
