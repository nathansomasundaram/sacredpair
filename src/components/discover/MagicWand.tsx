"use client";

import { useActionState } from "react";
import { WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { revealIntroductions, type RevealState } from "@/lib/discover/actions";

/** The magic wand button and what it has to say when nobody is ready yet. */
export function MagicWand({
  label,
  variant = "primary",
}: {
  label: string;
  variant?: "primary" | "quiet";
}) {
  const t = useTranslations("discover");
  const [state, action] = useActionState<RevealState, FormData>(
    revealIntroductions,
    {},
  );

  return (
    <form action={action} className="flex flex-col items-start gap-4">
      <SubmitButton variant={variant}>
        <WandSparkles aria-hidden size={19} />
        {label}
      </SubmitButton>
      {state.error === "noneYet" && (
        <FormAlert tone="success">
          <p className="font-semibold">{t("noneYetTitle")}</p>
          <p>{t("noneYetBody")}</p>
        </FormAlert>
      )}
      {state.error === "profileIncomplete" && (
        <FormAlert tone="error">
          <p>{t("profileIncompleteBody")}</p>
          <Link
            href="/profile/edit"
            className="font-semibold text-covenant underline"
          >
            {t("finishProfile")}
          </Link>
        </FormAlert>
      )}
      {state.error === "failed" && (
        <FormAlert tone="error">
          <p>{t("failed")}</p>
        </FormAlert>
      )}
    </form>
  );
}
