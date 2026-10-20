"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/forms/FormAlert";
import { PendingButton } from "@/components/forms/PendingButton";
import { useKeptForm } from "@/components/forms/useKeptForm";
import type { Settings } from "@/lib/settings/data";
import {
  saveNotifications,
  type NotifyState,
} from "@/lib/settings/notify-actions";
import { PushDevice } from "./PushDevice";

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
  disabled,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0">
      <label
        className={`flex items-start justify-between gap-4 ${disabled ? "opacity-60" : "cursor-pointer"}`}
      >
        <span>
          <span className="block font-semibold">{label}</span>
          {hint && (
            <span className="block text-[0.9375rem] text-ink-soft">{hint}</span>
          )}
        </span>
        <input
          type="checkbox"
          role="switch"
          name={name}
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="peer mt-1 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition-colors before:block before:size-5 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-paper before:shadow before:transition-transform checked:bg-covenant checked:before:translate-x-5.5 disabled:cursor-not-allowed rtl:before:-translate-x-0.5 rtl:checked:before:-translate-x-5.5"
        />
      </label>
      {children}
    </div>
  );
}

export function NotificationsForm({
  settings,
  email,
  pushKey,
  smsAvailable,
}: {
  settings: Settings;
  email: string;
  pushKey: string | null;
  smsAvailable: boolean;
}) {
  const t = useTranslations("settings.notifications");
  const { state, onSubmit, pending } = useKeptForm<NotifyState>(
    saveNotifications,
    {},
  );
  const n = settings.notify;
  const canText = smsAvailable && !!settings.phone && settings.phoneVerified;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <div aria-live="polite">
        {state.saved && <FormAlert tone="success">{t("saved")}</FormAlert>}
        {state.error && <FormAlert tone="error">{t("failed")}</FormAlert>}
      </div>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="mb-1 text-xl">
          {t("howHeading")}
        </h2>
        <div className="flex flex-col">
          <Toggle
            name="email"
            label={t("email")}
            hint={t("emailHint", { email })}
            defaultChecked={n.email}
          />
          <Toggle
            name="push"
            label={t("push")}
            hint={t("pushHint")}
            defaultChecked={n.push}
          >
            <PushDevice publicKey={pushKey} />
          </Toggle>
          <Toggle
            name="sms"
            label={t("sms")}
            hint={
              !smsAvailable
                ? t("smsUnavailable")
                : canText
                  ? t("smsHint", { phone: settings.phone! })
                  : t("smsNeedsPhone")
            }
            defaultChecked={n.sms && canText}
            disabled={!canText}
          >
            {smsAvailable && !canText && (
              <Link
                href="/settings/account#phone"
                className="self-start font-semibold text-covenant underline underline-offset-4"
              >
                {t("verifyPhone")}
              </Link>
            )}
          </Toggle>
        </div>
      </section>

      <section aria-labelledby="what-heading">
        <h2 id="what-heading" className="mb-1 text-xl">
          {t("whatHeading")}
        </h2>
        <p className="mb-2 text-[0.9375rem] text-ink-soft">{t("whatHint")}</p>
        <div className="flex flex-col">
          <Toggle
            name="messages"
            label={t("topics.messages")}
            hint={t("topics.messagesHint")}
            defaultChecked={n.messages}
          />
          <Toggle
            name="connections"
            label={t("topics.connections")}
            hint={t("topics.connectionsHint")}
            defaultChecked={n.connections}
          />
          <Toggle
            name="journey"
            label={t("topics.journey")}
            hint={t("topics.journeyHint")}
            defaultChecked={n.journey}
          />
          <Toggle
            name="marketing"
            label={t("topics.marketing")}
            hint={t("topics.marketingHint")}
            defaultChecked={n.marketing}
          />
        </div>
      </section>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] -mx-1 bg-paper/95 px-1 py-3 backdrop-blur md:bottom-0">
        <PendingButton pending={pending}>
          <Save aria-hidden size={18} />
          {t("save")}
        </PendingButton>
      </div>
    </form>
  );
}
