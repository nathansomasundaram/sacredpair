"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Film, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/forms/FormAlert";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { publicEnv } from "@/lib/env";
import {
  finishVideoUpload,
  removeVideo,
  requestVideoUpload,
} from "@/lib/profile/premium-actions";
import {
  VIDEO_ACCEPT,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
} from "@/lib/profile/premium-options";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "checking" }
  | { kind: "done" }
  | { kind: "error"; error: string };

/** Length of a video file in seconds, or null if the browser can't tell. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    video.src = url;
  });
}

/** Uploads straight to private storage with a one-time link, reporting progress. */
function uploadWithProgress(
  path: string,
  token: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const url = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/videos/${path}?token=${encodeURIComponent(token)}`;
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader(
      "apikey",
      publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
}

export function VideoUploader({ videoUrl }: { videoUrl: string | null }) {
  const t = useTranslations("premium");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [removing, startRemoving] = useTransition();
  const busy = phase.kind === "uploading" || phase.kind === "checking";

  async function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!VIDEO_ACCEPT.split(",").includes(file.type)) {
      return setPhase({ kind: "error", error: "videoNotSupported" });
    }
    if (file.size > VIDEO_MAX_BYTES)
      return setPhase({ kind: "error", error: "videoTooLarge" });
    const seconds = await readDuration(file);
    if (seconds !== null && seconds > VIDEO_MAX_SECONDS + 0.5) {
      return setPhase({ kind: "error", error: "videoTooLong" });
    }

    setPhase({ kind: "uploading", percent: 0 });
    const ticket = await requestVideoUpload({
      size: file.size,
      type: file.type,
    });
    if ("error" in ticket)
      return setPhase({ kind: "error", error: ticket.error });

    const uploaded = await uploadWithProgress(
      ticket.path,
      ticket.token,
      file,
      (percent) => setPhase({ kind: "uploading", percent }),
    );
    if (!uploaded) return setPhase({ kind: "error", error: "videoFailed" });

    setPhase({ kind: "checking" });
    const result = await finishVideoUpload(ticket.path);
    if (result.status === "error") {
      return setPhase({ kind: "error", error: result.error ?? "videoFailed" });
    }
    setPhase({ kind: "done" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.9375rem] text-ink-soft">
        {t("video.hint", { seconds: VIDEO_MAX_SECONDS })}
      </p>
      {videoUrl && (
        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          aria-label={t("video.label")}
          className="aspect-video w-full max-w-md rounded-xl bg-ink object-contain"
        />
      )}
      <div className="flex flex-wrap gap-3">
        <label
          className={`${quietButtonClass} cursor-pointer has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-[var(--focus)] ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <Film aria-hidden size={18} />
          {videoUrl ? t("video.replace") : t("video.choose")}
          <input
            type="file"
            accept={VIDEO_ACCEPT}
            onChange={onChoose}
            disabled={busy}
            className="sr-only"
          />
        </label>
        {videoUrl && (
          <button
            type="button"
            disabled={busy || removing}
            onClick={() =>
              startRemoving(async () => {
                await removeVideo();
                setPhase({ kind: "idle" });
              })
            }
            className={quietButtonClass}
          >
            <Trash2 aria-hidden size={18} />
            {t("video.remove")}
          </button>
        )}
      </div>
      <div aria-live="polite">
        {phase.kind === "uploading" && (
          <div className="flex flex-col gap-2">
            <p className="text-ink-soft">
              {t("video.uploading", { percent: phase.percent })}
            </p>
            <progress
              max={100}
              value={phase.percent}
              className="h-2 w-full max-w-md overflow-hidden rounded-full accent-covenant"
            />
          </div>
        )}
        {phase.kind === "checking" && (
          <p className="text-ink-soft">{t("video.checking")}</p>
        )}
        {phase.kind === "done" && (
          <FormAlert tone="success">{t("video.added")}</FormAlert>
        )}
        {phase.kind === "error" && (
          <FormAlert tone="error">{t(`errors.${phase.error}`)}</FormAlert>
        )}
      </div>
    </div>
  );
}
