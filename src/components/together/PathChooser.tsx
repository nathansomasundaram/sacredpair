import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { proposePath } from "@/lib/journey/actions";
import type { Level, PathInfo } from "@/lib/journey/content";
import { Scene } from "./Scene";

/** The three paths to choose from, each with its finished picture and levels. */
export function PathChooser({
  connectionId,
  name,
  paths,
}: {
  connectionId: string;
  name: string;
  paths: { info: PathInfo; levels: Level[] }[];
}) {
  const t = useTranslations("together");
  return (
    <section aria-labelledby="choose-heading">
      <h2 id="choose-heading" className="mb-1 text-2xl">
        {t("chooseTitle")}
      </h2>
      <p className="mb-6 max-w-prose text-ink-soft">
        {t("chooseBody", { name })}
      </p>
      <ul className="flex flex-col gap-4">
        {paths.map(({ info, levels }) => (
          <li
            key={info.path}
            className="grid overflow-hidden rounded-2xl border border-line bg-paper sm:grid-cols-[13rem_1fr]"
          >
            <Scene
              path={info.path}
              stage={9}
              label={t("finishedScene", { path: info.name })}
              className="h-44 sm:h-full"
            />
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <h3 className="text-xl">{info.name}</h3>
                <p className="font-semibold text-ink-soft">{info.tagline}</p>
              </div>
              <p className="text-[0.9375rem]">{info.description}</p>
              <details className="text-[0.9375rem]">
                <summary className="cursor-pointer font-semibold text-covenant">
                  {t("seeLevels")}
                </summary>
                <ol className="mt-2 list-decimal space-y-1 ps-5 text-ink-soft">
                  {levels.map((l) => (
                    <li key={l.level}>{l.title}</li>
                  ))}
                </ol>
              </details>
              <form action={proposePath} className="mt-auto pt-1">
                <input type="hidden" name="connectionId" value={connectionId} />
                <input type="hidden" name="path" value={info.path} />
                <SubmitButton>
                  <Lightbulb aria-hidden size={18} />
                  {t("suggest", { path: info.name })}
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
