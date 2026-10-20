"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/forms/FormAlert";
import {
  addExtraPhoto,
  removeExtraPhoto,
  type MediaState,
} from "@/lib/profile/premium-actions";
import type { ExtraPhoto } from "@/lib/profile/premium-data";
import { PHOTO_ACCEPT, PHOTO_PICK_MAX_BYTES } from "@/lib/profile/options";
import { MAX_EXTRA_PHOTOS } from "@/lib/profile/premium-options";
import { shrinkPhoto } from "@/lib/profile/shrink-photo";

const initial: MediaState = { status: "idle" };

export function ExtraPhotos({ photos }: { photos: ExtraPhoto[] }) {
  const t = useTranslations("premium");
  const [state, action] = useActionState(addExtraPhoto, initial);
  const [pending, startTransition] = useTransition();
  const [removing, startRemoving] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);
  const full = photos.length >= MAX_EXTRA_PHOTOS;

  async function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setClientError(null);
    if (file.size > PHOTO_PICK_MAX_BYTES)
      return setClientError("photoTooLarge");
    if (!PHOTO_ACCEPT.split(",").includes(file.type))
      return setClientError("photoNotImage");
    const blob = await shrinkPhoto(file);
    if (blob === "tooSmall") return setClientError("photoTooSmall");
    const form = new FormData();
    form.append("photo", blob, "photo");
    startTransition(() => action(form));
  }

  const error = clientError ?? (state.status === "error" ? state.error : null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.9375rem] text-ink-soft">
        {t("photos.hint", { max: MAX_EXTRA_PHOTOS })}
      </p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((photo, i) => (
          <li
            key={photo.id}
            className="relative aspect-[4/5] overflow-hidden rounded-xl bg-mist"
          >
            {photo.url && (
              <Image
                src={photo.url}
                alt={t("photos.alt", { number: i + 1 })}
                fill
                unoptimized
                sizes="160px"
                className={`object-cover ${removing ? "opacity-60" : ""}`}
              />
            )}
            <form
              action={(form) => startRemoving(() => removeExtraPhoto(form))}
              className="absolute end-1.5 top-1.5"
            >
              <input type="hidden" name="photoId" value={photo.id} />
              <button
                type="submit"
                disabled={removing}
                aria-label={t("photos.remove", { number: i + 1 })}
                className="grid size-9 place-items-center rounded-full bg-ink/75 text-paper hover:bg-ink"
              >
                <X aria-hidden size={18} />
              </button>
            </form>
          </li>
        ))}
        {!full && (
          <li className="aspect-[4/5]">
            <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-2 text-center text-[0.9375rem] font-semibold text-covenant hover:bg-mist has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]">
              {pending ? (
                <LoaderCircle aria-hidden size={24} className="animate-spin" />
              ) : (
                <ImagePlus aria-hidden size={24} />
              )}
              {t("photos.add")}
              <input
                type="file"
                accept={PHOTO_ACCEPT}
                onChange={onChoose}
                disabled={pending}
                className="sr-only"
              />
            </label>
          </li>
        )}
      </ul>
      <p className="text-[0.9375rem] text-ink-soft">
        {t("photos.count", { count: photos.length, max: MAX_EXTRA_PHOTOS })}
      </p>
      <div aria-live="polite">
        {pending && <p className="text-ink-soft">{t("photos.uploading")}</p>}
        {!pending && !error && state.status === "success" && (
          <FormAlert tone="success">{t("photos.added")}</FormAlert>
        )}
        {!pending && error && (
          <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert>
        )}
        {full && !pending && (
          <p className="text-ink-soft">{t("photos.full")}</p>
        )}
      </div>
    </div>
  );
}
