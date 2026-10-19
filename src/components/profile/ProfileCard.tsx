import Image from "next/image";
import { MapPin, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProfileOverview } from "@/lib/profile/data";

/**
 * The Profile Overview as other members see it: picture, name, age, place,
 * about me and traits. Used on the member's own Profile tab and, later, in
 * Discover.
 */
export function ProfileCard({
  profile,
  photoUrl,
}: {
  profile: ProfileOverview;
  photoUrl: string | null;
}) {
  const t = useTranslations("profile");
  const tTraits = useTranslations("options.traits");
  const name = profile.displayName || "…";

  return (
    <article
      aria-label={profile.displayName || undefined}
      className="overflow-hidden rounded-2xl border border-line bg-paper"
    >
      <div className="relative aspect-[4/5] w-full bg-mist">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={t("photoAlt", { name })}
            fill
            sizes="(min-width: 768px) 420px, 100vw"
            // Signed links are short-lived and already resized on upload.
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-ink-soft">
            <UserRound aria-hidden size={72} strokeWidth={1.25} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl">
            {name}
            {profile.age !== null && (
              <span className="ms-3 font-sans text-lg font-normal text-ink-soft">
                {t("age", { age: profile.age })}
              </span>
            )}
          </h2>
          {(profile.city || profile.stateCode) && (
            <p className="flex items-center gap-1.5 text-ink-soft">
              <MapPin aria-hidden size={17} className="shrink-0" />
              {[profile.city, profile.stateCode].filter(Boolean).join(", ")}
            </p>
          )}
        </header>

        <section className="flex flex-col gap-2">
          <h3 className="font-sans text-[0.9375rem] font-semibold text-ink-soft">
            {t("aboutHeading")}
          </h3>
          <p className="whitespace-pre-line">
            {profile.aboutMe || (
              <span className="text-ink-soft">{t("noAbout")}</span>
            )}
          </p>
        </section>

        {profile.traits.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h3 className="font-sans text-[0.9375rem] font-semibold text-ink-soft">
              {t("traitsHeading")}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {profile.traits.map((trait) => (
                <li
                  key={trait}
                  className="rounded-full bg-mist px-3.5 py-1.5 text-[0.9375rem] text-ink"
                >
                  {tTraits(trait)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
