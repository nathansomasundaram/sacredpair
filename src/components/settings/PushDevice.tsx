"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/lib/settings/notify-actions";

type Status =
  "checking" | "unsupported" | "notConfigured" | "blocked" | "off" | "on";

function keyBytes(base64: string) {
  const s = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** Turns push notifications on or off for this browser. */
export function PushDevice({ publicKey }: { publicKey: string | null }) {
  const t = useTranslations("settings.notifications.device");
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return setStatus("unsupported");
      }
      if (!publicKey) return setStatus("notConfigured");
      if (Notification.permission === "denied") return setStatus("blocked");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, [publicKey]);

  async function turnOn() {
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        return setStatus(permission === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey!),
      });
      const ok = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!ok) {
        await sub.unsubscribe();
        setNote(t("failed"));
        return;
      }
      setStatus("on");
    } catch {
      setNote(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const r = await sendTestPush(sub.endpoint);
    setNote(t(`test.${r}`));
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-xl bg-mist/60 px-4 py-3">
      <p className="text-[0.9375rem]" aria-live="polite">
        {status === "checking" ? t("checking") : t(`status.${status}`)}
      </p>
      <div className="flex flex-wrap gap-2">
        {status === "off" && (
          <button
            type="button"
            onClick={turnOn}
            disabled={busy}
            className={quietButtonClass}
          >
            {busy ? (
              <LoaderCircle aria-hidden size={17} className="animate-spin" />
            ) : (
              <BellRing aria-hidden size={17} />
            )}
            {t("turnOn")}
          </button>
        )}
        {status === "on" && (
          <>
            <button type="button" onClick={test} className={quietButtonClass}>
              {t("sendTest")}
            </button>
            <button
              type="button"
              onClick={turnOff}
              disabled={busy}
              className={quietButtonClass}
            >
              <BellOff aria-hidden size={17} />
              {t("turnOff")}
            </button>
          </>
        )}
      </div>
      {note && <p className="text-[0.9375rem] text-ink-soft">{note}</p>}
    </div>
  );
}
