import Link from "next/link";
import { Check, Clock, Lock, Play, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Level } from "@/lib/journey/content";
import { canPlay, type LevelState } from "@/lib/journey/progress";

const STYLE: Record<LevelState, { ring: string; icon: typeof Check }> = {
  together: { ring: "bg-leaf text-paper border-leaf", icon: Check },
  you: { ring: "bg-leaf/15 text-leaf border-leaf/50", icon: Clock },
  partner: { ring: "bg-covenant text-on-covenant border-covenant", icon: Play },
  open: { ring: "bg-covenant text-on-covenant border-covenant", icon: Play },
  waiting: { ring: "bg-mist text-ink-soft border-line", icon: Clock },
  locked: { ring: "bg-mist text-ink-soft border-line", icon: Lock },
};

/** The nine levels as a winding path, with where each person stands. */
export function JourneyMap({
  connectionId,
  levels,
  states,
  name,
}: {
  connectionId: string;
  levels: Level[];
  states: LevelState[];
  name: string;
}) {
  const t = useTranslations("together.level");
  return (
    <ol className="flex flex-col gap-2">
      {levels.map((l, i) => {
        const state = states[i];
        const { ring, icon: Icon } = STYLE[state];
        const playable = canPlay(state);
        const current = state === "open" || state === "partner";
        // A gentle zigzag, like a path up a hill.
        const offset = ["ms-0", "ms-4", "ms-8", "ms-4"][i % 4];
        const body = (
          <>
            <span
              className={`grid size-14 shrink-0 place-items-center rounded-full border-2 ${ring} ${current ? "ring-4 ring-ring/50" : ""}`}
            >
              {state === "together" || state === "you" || current ? (
                <Icon aria-hidden size={22} />
              ) : (
                <span className="font-display text-lg">{l.level}</span>
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.8125rem] font-semibold uppercase tracking-wide text-ink-soft">
                {t("number", { level: l.level })}
              </span>
              <span className="font-display text-lg leading-tight">
                {l.title}
              </span>
              <span
                className={`text-[0.9375rem] ${current ? "font-semibold text-covenant" : "text-ink-soft"}`}
              >
                {t(`state.${state}`, { name })}
              </span>
            </span>
            {(state === "together" || state === "you") && (
              <RotateCcw
                aria-hidden
                size={16}
                className="ms-auto shrink-0 text-ink-soft"
              />
            )}
          </>
        );
        return (
          <li key={l.level} className={offset}>
            {playable ? (
              <Link
                href={`/together/${connectionId}/level/${l.level}`}
                aria-label={`${t("number", { level: l.level })}: ${l.title}. ${t(`state.${state}`, { name })}${state === "together" || state === "you" ? `. ${t("practice")}` : ""}`}
                className={`flex max-w-md items-center gap-4 rounded-2xl p-2 pe-4 transition-colors hover:bg-mist/70 ${current ? "bg-covenant/[0.06]" : ""}`}
              >
                {body}
              </Link>
            ) : (
              <div className="flex max-w-md items-center gap-4 p-2 pe-4 opacity-80">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
