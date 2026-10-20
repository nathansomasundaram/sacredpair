import Link from "next/link";
import { UserRoundX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";

/** Someone the member wasn't introduced to, or who is no longer here. */
export default async function ProfileNotFound() {
  const t = await getTranslations("details");
  return (
    <EmptyState
      icon={UserRoundX}
      title={t("notFoundTitle")}
      body={t("notFoundBody")}
    >
      <Link href="/details" className={quietButtonClass}>
        {t("backToList")}
      </Link>
    </EmptyState>
  );
}
