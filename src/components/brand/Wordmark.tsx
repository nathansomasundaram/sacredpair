import { useTranslations } from "next-intl";
import { PairMark } from "./PairMark";

export function Wordmark({ size = 28 }: { size?: number }) {
  const t = useTranslations("app");
  return (
    <span className="inline-flex items-center gap-2.5">
      <PairMark size={size} />
      <span className="font-display text-xl font-medium tracking-tight text-ink">
        {t("name")}
      </span>
    </span>
  );
}
