"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Check,
  CircleCheck,
  CircleX,
  LoaderCircle,
  MessageCircle,
  X,
} from "lucide-react";
import {
  primaryButtonClass,
  quietButtonClass,
} from "@/components/ui/buttonStyles";
import { completeLevel, type CompleteResult } from "@/lib/journey/actions";
import type { Level, PathCode, Question, Stage } from "@/lib/journey/content";
import { seededShuffle } from "@/lib/journey/shuffle";
import { Scene } from "./Scene";

type Phase = "intro" | "question" | "saving" | "result";
type Feedback = { correct: boolean } | null;

/**
 * Plays one level: four questions with an explanation after each. Anything
 * missed comes back once at the end. The score is how many were right the
 * first time; there's no failing.
 */
export function LessonPlayer({
  connectionId,
  journeyId,
  level,
  path,
  partnerName,
  partnerDone: partnerDoneAtStart,
  replay: replayAtStart,
  nextStage,
}: {
  connectionId: string;
  journeyId: string;
  level: Level;
  path: PathCode;
  partnerName: string;
  /** Whether the partner already finished this level (so the scene grows now). */
  partnerDone: boolean;
  /** Playing a level already finished, for practice. */
  replay: boolean;
  nextStage: Stage;
}) {
  const t = useTranslations("together.lesson");
  // As things stood when the level began. Saving refreshes the page in the
  // background, which would otherwise count this very play as a replay.
  const [{ partnerDone, replay }] = useState(() => ({
    partnerDone: partnerDoneAtStart,
    replay: replayAtStart,
  }));
  const [phase, setPhase] = useState<Phase>("intro");
  const [queue, setQueue] = useState(() => level.questions.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<CompleteResult | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const total = level.questions.length;
  const index = queue[pos];
  const question = level.questions[index];
  const progress =
    phase === "intro"
      ? 0
      : Math.min(1, (pos + (feedback ? 1 : 0)) / queue.length);
  const correctFirst = Object.values(firstTry).filter(Boolean).length;

  function answer(correct: boolean) {
    setFeedback({ correct });
    if (!(index in firstTry)) setFirstTry((f) => ({ ...f, [index]: correct }));
    // Missed questions come back once, at the end.
    if (
      !correct &&
      !queue.slice(pos + 1).includes(index) &&
      !(index in firstTry)
    ) {
      setQueue((q) => [...q, index]);
    }
    requestAnimationFrame(() => continueRef.current?.focus());
  }

  async function next() {
    setFeedback(null);
    if (pos + 1 < queue.length) {
      setPos(pos + 1);
      return;
    }
    setPhase("saving");
    const score = Math.round((correctFirst / total) * 100);
    try {
      setResult(
        await completeLevel(connectionId, journeyId, level.level, score),
      );
    } catch {
      setResult({ ok: false, error: "failed" });
    }
    setPhase("result");
  }

  const back = `/together/${connectionId}`;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-xl flex-col md:min-h-[calc(100dvh-5rem)]">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={back}
          aria-label={t("leave")}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-mist"
        >
          <X aria-hidden size={22} />
        </Link>
        <div
          role="progressbar"
          aria-label={t("progressLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-3 flex-1 overflow-hidden rounded-full bg-mist"
        >
          <div
            className="h-full rounded-full bg-leaf transition-[width] duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {phase === "intro" && (
        <div className="flex flex-1 flex-col items-start gap-4">
          <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-ink-soft">
            {t("levelNumber", { level: level.level })}
          </p>
          <h1 className="text-3xl">{level.title}</h1>
          <p className="text-lg text-ink-soft">{level.intro}</p>
          <p className="text-ink-soft">{t("howItWorks", { count: total })}</p>
          <button
            type="button"
            onClick={() => setPhase("question")}
            className={`${primaryButtonClass} mt-2`}
          >
            {t("begin")}
          </button>
        </div>
      )}

      {phase === "question" && question && (
        <div className="flex flex-1 flex-col">
          <p className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-wide text-ink-soft">
            {pos >= total ? t("again") : t(`kind.${question.type}`)}
          </p>
          <QuestionView
            key={`${pos}-${index}`}
            question={question}
            seed={`${journeyId}-${level.level}-${index}-${pos}`}
            locked={!!feedback}
            onAnswer={answer}
          />
          <div className="mt-auto sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] -mx-1 bg-paper/95 px-1 pb-3 pt-3 backdrop-blur md:bottom-0">
            <div role="status" aria-live="polite">
              {feedback && (
                <div
                  className={`mb-4 flex flex-col gap-1 rounded-2xl px-4 py-3 ${feedback.correct ? "bg-leaf/[0.1]" : "bg-danger/[0.07]"}`}
                >
                  <p
                    className={`flex items-center gap-2 font-semibold ${feedback.correct ? "text-leaf" : "text-danger"}`}
                  >
                    {feedback.correct ? (
                      <CircleCheck aria-hidden size={20} />
                    ) : (
                      <CircleX aria-hidden size={20} />
                    )}
                    {feedback.correct ? t("correct") : t("notQuite")}
                  </p>
                  <p>{question.why}</p>
                  {!feedback.correct && pos < total && (
                    <p className="text-[0.9375rem] text-ink-soft">
                      {t("comesBack")}
                    </p>
                  )}
                </div>
              )}
            </div>
            {feedback && (
              <button
                ref={continueRef}
                type="button"
                onClick={next}
                className={`${primaryButtonClass} w-full`}
              >
                {t("continue")}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "saving" && (
        <p
          role="status"
          className="flex flex-1 items-center justify-center gap-2 text-ink-soft"
        >
          <LoaderCircle aria-hidden size={20} className="animate-spin" />
          {t("saving")}
        </p>
      )}

      {phase === "result" && result && (
        <div className="flex flex-1 flex-col gap-6">
          {result.ok ? (
            <>
              <div className="flex flex-col items-start gap-2">
                <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-leaf">
                  {t("levelDone", { level: level.level })}
                </p>
                <h1 className="text-3xl">
                  {t("score", { correct: correctFirst, total })}
                </h1>
                {replay && <p className="text-ink-soft">{t("practiceDone")}</p>}
              </div>
              <section className="overflow-hidden rounded-2xl border border-line bg-paper">
                <Scene
                  path={path}
                  stage={partnerDone ? level.level : level.level - 1}
                  animate={partnerDone && !replay}
                  label={nextStage.description}
                />
                <div className="p-4">
                  <p className="font-semibold">
                    {replay && partnerDone
                      ? t("reached", { stage: nextStage.name })
                      : partnerDone
                        ? t("grewTogether", { stage: nextStage.name })
                        : t("growsWhen", {
                            name: partnerName,
                            stage: nextStage.name,
                          })}
                  </p>
                  <p className="text-[0.9375rem] text-ink-soft">
                    {nextStage.description}
                  </p>
                </div>
              </section>
              <section
                aria-labelledby="talk-heading"
                className="rounded-2xl border border-covenant/30 bg-covenant/[0.06] px-5 py-4"
              >
                <h2
                  id="talk-heading"
                  className="mb-1 font-sans text-base font-semibold"
                >
                  {t("talkHeading", { name: partnerName })}
                </h2>
                <p className="font-display text-xl leading-snug">
                  {level.talk}
                </p>
              </section>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/chat/${connectionId}`}
                  className={primaryButtonClass}
                >
                  <MessageCircle aria-hidden size={18} />
                  {t("talkInChat")}
                </Link>
                <Link href={back} className={quietButtonClass}>
                  {t("backToJourney")}
                </Link>
              </div>
            </>
          ) : (
            <div role="alert" className="flex flex-col items-start gap-4">
              <h1 className="text-2xl">{t("notSaved")}</h1>
              <p className="text-ink-soft">
                {t(`error.${result.error}`, { name: partnerName })}
              </p>
              <Link href={back} className={quietButtonClass}>
                {t("backToJourney")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionView({
  question,
  seed,
  locked,
  onAnswer,
}: {
  question: Question;
  seed: string;
  locked: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  return (
    <>
      <h1 className="mb-6 text-2xl leading-snug">{question.prompt}</h1>
      {question.type === "choice" && (
        <Choice q={question} seed={seed} locked={locked} onAnswer={onAnswer} />
      )}
      {question.type === "truefalse" && (
        <TrueFalse q={question} locked={locked} onAnswer={onAnswer} />
      )}
      {question.type === "order" && (
        <Order q={question} seed={seed} locked={locked} onAnswer={onAnswer} />
      )}
      {question.type === "match" && (
        <Match q={question} seed={seed} locked={locked} onAnswer={onAnswer} />
      )}
    </>
  );
}

const optionClass = (state: "idle" | "picked" | "right" | "wrong") =>
  [
    "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-start transition-colors",
    state === "right"
      ? "border-leaf bg-leaf/[0.1]"
      : state === "wrong"
        ? "border-danger bg-danger/[0.07]"
        : state === "picked"
          ? "border-covenant bg-covenant/[0.07]"
          : "border-line bg-paper hover:border-covenant/50",
  ].join(" ");

function CheckButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("together.lesson");
  return (
    <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] -mx-1 bg-paper/95 px-1 pb-3 pt-3 backdrop-blur md:bottom-0 mt-5">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`${primaryButtonClass} w-full disabled:opacity-40`}
      >
        {t("check")}
      </button>
    </div>
  );
}

function Choice({
  q,
  seed,
  locked,
  onAnswer,
}: {
  q: Extract<Question, { type: "choice" }>;
  seed: string;
  locked: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const order = useMemo(
    () =>
      seededShuffle(
        q.options.map((_, i) => i),
        seed,
      ),
    [q, seed],
  );
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <>
      <div
        role="radiogroup"
        aria-label={q.prompt}
        className="flex flex-col gap-2.5"
      >
        {order.map((i) => {
          const state = locked
            ? i === q.answer
              ? "right"
              : i === picked
                ? "wrong"
                : "idle"
            : i === picked
              ? "picked"
              : "idle";
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={picked === i}
              disabled={locked}
              onClick={() => setPicked(i)}
              className={optionClass(state)}
            >
              {q.options[i]}
            </button>
          );
        })}
      </div>
      {!locked && (
        <CheckButton
          disabled={picked === null}
          onClick={() => onAnswer(picked === q.answer)}
        />
      )}
    </>
  );
}

function TrueFalse({
  q,
  locked,
  onAnswer,
}: {
  q: Extract<Question, { type: "truefalse" }>;
  locked: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const t = useTranslations("together.lesson");
  const [picked, setPicked] = useState<boolean | null>(null);
  return (
    <>
      <div
        role="radiogroup"
        aria-label={q.prompt}
        className="grid grid-cols-2 gap-3"
      >
        {[true, false].map((v) => {
          const state = locked
            ? v === q.answer
              ? "right"
              : v === picked
                ? "wrong"
                : "idle"
            : v === picked
              ? "picked"
              : "idle";
          return (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={picked === v}
              disabled={locked}
              onClick={() => setPicked(v)}
              className={`${optionClass(state)} justify-center font-semibold`}
            >
              {v ? t("true") : t("false")}
            </button>
          );
        })}
      </div>
      {!locked && (
        <CheckButton
          disabled={picked === null}
          onClick={() => onAnswer(picked === q.answer)}
        />
      )}
    </>
  );
}

function Order({
  q,
  seed,
  locked,
  onAnswer,
}: {
  q: Extract<Question, { type: "order" }>;
  seed: string;
  locked: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const t = useTranslations("together.lesson");
  const shuffled = useMemo(
    () =>
      seededShuffle(
        q.items.map((_, i) => i),
        seed,
      ),
    [q, seed],
  );
  const [chosen, setChosen] = useState<number[]>([]);
  const left = shuffled.filter((i) => !chosen.includes(i));
  const correct = chosen.every((v, i) => v === i);
  return (
    <>
      <p className="mb-2 text-[0.9375rem] text-ink-soft">{t("orderHint")}</p>
      <ol
        aria-label={t("yourOrder")}
        className="mb-4 flex min-h-16 flex-col gap-2 rounded-2xl border-2 border-dashed border-line p-2"
      >
        {chosen.map((i, n) => (
          <li key={i}>
            <button
              type="button"
              disabled={locked}
              onClick={() => setChosen(chosen.filter((x) => x !== i))}
              aria-label={t("removeStep", { step: q.items[i] })}
              className={optionClass(
                locked ? (i === n ? "right" : "wrong") : "picked",
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-covenant text-[0.875rem] font-semibold text-on-covenant">
                {n + 1}
              </span>
              {q.items[i]}
            </button>
          </li>
        ))}
      </ol>
      {left.length > 0 && (
        <ul aria-label={t("stepsLeft")} className="flex flex-col gap-2">
          {left.map((i) => (
            <li key={i}>
              <button
                type="button"
                disabled={locked}
                onClick={() => setChosen([...chosen, i])}
                className={optionClass("idle")}
              >
                {q.items[i]}
              </button>
            </li>
          ))}
        </ul>
      )}
      {locked && !correct && (
        <ol className="mt-4 list-decimal space-y-1 ps-6 text-[0.9375rem]">
          <p className="-ms-6 mb-1 font-semibold">{t("rightOrder")}</p>
          {q.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      )}
      {!locked && (
        <CheckButton
          disabled={chosen.length !== q.items.length}
          onClick={() => onAnswer(correct)}
        />
      )}
    </>
  );
}

function Match({
  q,
  seed,
  locked,
  onAnswer,
}: {
  q: Extract<Question, { type: "match" }>;
  seed: string;
  locked: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const t = useTranslations("together.lesson");
  const rights = useMemo(
    () =>
      seededShuffle(
        q.pairs.map((_, i) => i),
        seed,
      ),
    [q, seed],
  );
  const [left, setLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [miss, setMiss] = useState<number | null>(null);
  const mistakes = useRef(0);

  function pickRight(i: number) {
    if (left === null || locked) return;
    if (i === left) {
      const done = [...matched, i];
      setMatched(done);
      setLeft(null);
      if (done.length === q.pairs.length) onAnswer(mistakes.current === 0);
    } else {
      mistakes.current += 1;
      setMiss(i);
      setLeft(null);
      window.setTimeout(() => setMiss(null), 600);
    }
  }

  return (
    <>
      <p className="mb-3 text-[0.9375rem] text-ink-soft">{t("matchHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        <ul aria-label={t("matchLeft")} className="flex flex-col gap-2">
          {q.pairs.map(([a], i) => (
            <li key={a}>
              <button
                type="button"
                aria-pressed={left === i}
                disabled={matched.includes(i) || locked}
                onClick={() => setLeft(i)}
                className={`${optionClass(matched.includes(i) ? "right" : left === i ? "picked" : "idle")} min-h-16 font-semibold`}
              >
                {matched.includes(i) && (
                  <Check aria-hidden size={16} className="shrink-0 text-leaf" />
                )}
                {a}
              </button>
            </li>
          ))}
        </ul>
        <ul aria-label={t("matchRight")} className="flex flex-col gap-2">
          {rights.map((i) => (
            <li key={q.pairs[i][1]}>
              <button
                type="button"
                disabled={matched.includes(i) || locked || left === null}
                onClick={() => pickRight(i)}
                className={`${optionClass(matched.includes(i) ? "right" : miss === i ? "wrong" : "idle")} min-h-16 text-[0.9375rem]`}
              >
                {q.pairs[i][1]}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
