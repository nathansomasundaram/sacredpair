import Link from "next/link";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/Wordmark";
import { TextLink } from "@/components/ui/TextLink";

// Holds the place of a policy until the reviewed text is ready.
export function LegalPage({ title }: { title: string }) {
  const t = useTranslations("legal");
  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <Link href="/" className="inline-block">
        <Wordmark size={26} />
      </Link>
      <main id="main" className="py-12">
        <h1 className="mb-6 text-2xl sm:text-3xl">{title}</h1>
        <p className="max-w-[60ch] text-ink-soft">{t("placeholder")}</p>
        <p className="mt-8">
          <TextLink href="/">{t("backHome")}</TextLink>
        </p>
      </main>
    </div>
  );
}
