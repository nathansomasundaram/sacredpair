"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, LoaderCircle, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/forms/FormAlert";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { uploadProfilePhoto, type PhotoState } from "@/lib/profile/actions";
import {
  PHOTO_ACCEPT,
  PHOTO_MIN_SIDE,
  PHOTO_PICK_MAX_BYTES,
  PHOTO_UPLOAD_MAX_BYTES,
} from "@/lib/profile/options";

const initial: PhotoState = { status: "idle" };
const MAX_SIDE = 2000;

/**
 * Shrinks a large photo in the browser before upload: faster on phones and
 * keeps uploads small. The server checks and re-encodes it again anyway.
 */
async function shrink(file: File): Promise<Blob | "tooSmall"> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // The server decides whether it can read this file.
  }
  const { width, height } = bitmap;
  if (Math.min(width, height) < PHOTO_MIN_SIDE) return "tooSmall";
  if (
    Math.max(width, height) <= MAX_SIDE &&
    file.size <= PHOTO_UPLOAD_MAX_BYTES
  ) {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.9),
  );
}

export function PhotoUploader({ photoUrl }: { photoUrl: string | null }) {
  const t = useTranslations("profile");
  const [state, action] = useActionState(uploadProfilePhoto, initial);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setClientError(null);
    if (file.size > PHOTO_PICK_MAX_BYTES)
      return setClientError("photoTooLarge");
    if (!PHOTO_ACCEPT.split(",").includes(file.type))
      return setClientError("photoNotImage");

    const blob = await shrink(file);
    if (blob === "tooSmall") return setClientError("photoTooSmall");

    setPreview(URL.createObjectURL(blob));
    const form = new FormData();
    form.append("photo", blob, "photo");
    startTransition(() => action(form));
  }

  const error = clientError ?? (state.status === "error" ? state.error : null);
  // A photo the server turned down isn't kept on screen.
  const shown =
    state.status === "error" && !pending ? photoUrl : (preview ?? photoUrl);

  return (
    <section aria-labelledby="photo-heading" className="flex flex-col gap-4">
      <h2 id="photo-heading" className="font-sans text-base font-semibold">
        {t("editor.photoHeading")}
      </h2>
      <div className="flex items-center gap-5">
        <div className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-mist sm:size-32">
          {shown ? (
            <Image
              src={shown}
              alt=""
              fill
              unoptimized
              sizes="128px"
              className={`object-cover ${pending ? "opacity-60" : ""}`}
            />
          ) : (
            <div className="grid h-full place-items-center text-ink-soft">
              <UserRound aria-hidden size={44} strokeWidth={1.25} />
            </div>
          )}
          {pending && (
            <div className="absolute inset-0 grid place-items-center">
              <LoaderCircle
                aria-hidden
                size={28}
                className="animate-spin text-covenant"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <label
            className={`${quietButtonClass} cursor-pointer focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-[var(--focus)]`}
          >
            <Camera aria-hidden size={18} />
            {shown ? t("editor.changePhoto") : t("editor.choosePhoto")}
            <input
              type="file"
              name="photo"
              accept={PHOTO_ACCEPT}
              onChange={onChoose}
              disabled={pending}
              className="sr-only"
            />
          </label>
          <p className="text-[0.9375rem] text-ink-soft">
            {t("editor.photoHint")}
          </p>
        </div>
      </div>
      <div aria-live="polite">
        {pending && <p className="text-ink-soft">{t("editor.uploading")}</p>}
        {!pending && !error && state.status === "success" && (
          <FormAlert tone="success">{t("editor.uploaded")}</FormAlert>
        )}
        {!pending && error && (
          <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert>
        )}
      </div>
    </section>
  );
}
