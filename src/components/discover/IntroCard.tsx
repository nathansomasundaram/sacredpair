import Image from "next/image";
import Link from "next/link";
import { ChevronRight, MapPin, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProfileOverview } from "@/lib/profile/data";

/**
 * One of the week's introductions, compact enough that all four fit on a
 * phone screen in two columns. Opens the person's details.
 */
export function IntroCard({
  profile,
  photoUrl,
  index,
  animate,
}: {
  profile: ProfileOverview;
  photoUrl: string | null;
  index: number;
  animate: boolean;
}) {
  const t = useTranslations("discover");
  const tProfile = useTranslations("profile");
  const tTraits = useTranslations("options.traits");
  const place = [profile.city, profile.stateCode].filter(Boolean).join(", ");

  return (
    <li
      className={animate ? "intro-arrive" : undefined}
      style={animate ? ({ "--i": index } as React.CSSProperties) : undefined}
    >
      <Link
        href={`/details/${profile.id}`}
        aria-label={t("openDetails", { name: profile.displayName })}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper transition-shadow hover:shadow-[0_6px_24px_-12px_rgb(30_35_64/0.35)] focus-visible:rounded-2xl"
      >
        <div className="relative aspect-[4/5] w-full bg-mist">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={tProfile("photoAlt", { name: profile.displayName })}
              fill
              sizes="(min-width: 768px) 320px, 50vw"
              unoptimized
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid h-full place-items-center text-ink-soft">
              <UserRound aria-hidden size={56} strokeWidth={1.25} />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3.5 sm:gap-2 sm:p-5">
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-lg leading-tight sm:text-xl">
            <span>{profile.displayName}</span>
            {profile.age !== null && (
              <span className="font-sans text-base font-normal text-ink-soft">
                {tProfile("age", { age: profile.age })}
              </span>
            )}
          </h2>
          {place && (
            <p className="flex items-center gap-1 text-[0.9375rem] text-ink-soft">
              <MapPin aria-hidden size={15} className="shrink-0" />
              <span className="truncate">{place}</span>
            </p>
          )}
          {profile.aboutMe && (
            <div className="hidden sm:block">
              <p className="line-clamp-2 text-[0.9375rem]">{profile.aboutMe}</p>
            </div>
          )}
          {profile.traits.length > 0 && (
            <ul className="hidden flex-wrap gap-1.5 sm:flex">
              {profile.traits.slice(0, 3).map((trait) => (
                <li
                  key={trait}
                  className="rounded-full bg-mist px-2.5 py-1 text-sm text-ink"
                >
                  {tTraits(trait)}
                </li>
              ))}
            </ul>
          )}
          <span className="mt-auto flex items-center gap-1 pt-1 text-[0.9375rem] font-semibold text-covenant">
            {t("viewProfile")}
            <ChevronRight
              aria-hidden
              size={17}
              className="transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100"
            />
          </span>
        </div>
      </Link>
    </li>
  );
}
