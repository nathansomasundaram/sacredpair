import Link from "next/link";
import { Heart, MessageCircle, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { primaryButtonClass } from "@/components/ui/buttonStyles";
import { setChoice } from "@/lib/connect/actions";
import type { ConnectState } from "@/lib/connect/data";

/**
 * Choose or pass on someone, and where that stands. Choices are private:
 * the other person only learns of it if they choose the member too, and
 * then both are connected and can chat.
 */
export function ConnectPanel({
  profileId,
  name,
  state,
}: {
  profileId: string;
  name: string;
  state: ConnectState;
}) {
  const t = useTranslations("connect");

  if (state.connection?.active) {
    return (
      <section
        aria-labelledby="connect-heading"
        className="flex flex-col items-start gap-3 rounded-2xl border border-leaf/40 bg-leaf/[0.08] px-5 py-5"
      >
        <h2 id="connect-heading" className="text-xl">
          {t("connectedTitle", { name })}
        </h2>
        <p className="text-ink-soft">{t("connectedBody", { name })}</p>
        <Link
          href={`/chat/${state.connection.id}`}
          className={primaryButtonClass}
        >
          <MessageCircle aria-hidden size={18} />
          {t("openChat")}
        </Link>
      </section>
    );
  }

  if (state.connection) {
    return (
      <section
        aria-labelledby="connect-heading"
        className="rounded-2xl border border-line px-5 py-5"
      >
        <h2
          id="connect-heading"
          className="mb-1 font-sans text-base font-semibold"
        >
          {t("endedTitle")}
        </h2>
        <p className="text-ink-soft">{t("endedBody", { name })}</p>
      </section>
    );
  }

  const form = (
    decision: "choose" | "pass",
    children: React.ReactNode,
    variant: "primary" | "quiet",
  ) => (
    <form action={setChoice}>
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="decision" value={decision} />
      <SubmitButton variant={variant}>{children}</SubmitButton>
    </form>
  );

  if (state.choice === "chosen") {
    return (
      <section
        aria-labelledby="connect-heading"
        className="flex flex-col items-start gap-3 rounded-2xl border border-covenant/30 bg-covenant/[0.06] px-5 py-5"
      >
        <h2 id="connect-heading" className="flex items-center gap-2 text-xl">
          <Heart
            aria-hidden
            size={20}
            className="fill-covenant text-covenant"
          />
          {t("chosenTitle", { name })}
        </h2>
        <p className="text-ink-soft">{t("chosenBody", { name })}</p>
        {form(
          "pass",
          <>
            <Undo2 aria-hidden size={17} />
            {t("changeMind")}
          </>,
          "quiet",
        )}
      </section>
    );
  }

  if (state.choice === "passed") {
    return (
      <section
        aria-labelledby="connect-heading"
        className="flex flex-col items-start gap-3 rounded-2xl border border-line px-5 py-5"
      >
        <h2 id="connect-heading" className="font-sans text-base font-semibold">
          {t("passedTitle", { name })}
        </h2>
        <p className="text-ink-soft">{t("passedBody", { name })}</p>
        {form(
          "choose",
          <>
            <Heart aria-hidden size={17} />
            {t("chooseInstead", { name })}
          </>,
          "quiet",
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="connect-heading"
      className="flex flex-col gap-4 rounded-2xl border border-line px-5 py-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="connect-heading" className="text-xl">
          {t("askTitle", { name })}
        </h2>
        <p className="text-ink-soft">{t("askBody", { name })}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {form(
          "choose",
          <>
            <Heart aria-hidden size={18} />
            {t("choose", { name })}
          </>,
          "primary",
        )}
        {form(
          "pass",
          <>
            <X aria-hidden size={18} />
            {t("pass")}
          </>,
          "quiet",
        )}
      </div>
    </section>
  );
}

/** A small label for lists: where the member stands with someone. */
export function ConnectChip({ state }: { state: ConnectState | undefined }) {
  const t = useTranslations("connect.chip");
  if (!state) return null;
  const kind = state.connection?.active
    ? "connected"
    : state.connection
      ? "ended"
      : state.choice;
  if (!kind) return null;
  const tone =
    kind === "connected"
      ? "border-leaf/40 bg-leaf/10 text-ink"
      : kind === "chosen"
        ? "border-covenant/30 bg-covenant/[0.07] text-ink"
        : "border-line text-ink-soft";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.8125rem] ${tone}`}
    >
      {t(kind)}
    </span>
  );
}
