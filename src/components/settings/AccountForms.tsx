"use client";

import { BadgeCheck, CircleAlert, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/forms/Field";
import { FormAlert } from "@/components/forms/FormAlert";
import { PasswordField } from "@/components/forms/PasswordField";
import { PendingButton } from "@/components/forms/PendingButton";
import { useKeptForm } from "@/components/forms/useKeptForm";
import {
  changeEmail,
  changePassword,
  changePhone,
  confirmPhoneCode,
  deleteAccount,
  requestPhoneCode,
  type AccountState,
} from "@/lib/account/actions";

/** An error key from account actions: our own, or one of auth.errors. */
function useErrorText() {
  const t = useTranslations("settings.account.errors");
  const tAuth = useTranslations("auth.errors");
  return (key?: string) =>
    key
      ? t.has(key)
        ? t(key)
        : tAuth.has(key)
          ? tAuth(key)
          : tAuth("generic")
      : undefined;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-20 border-b border-line pb-10"
    >
      <h2 id={`${id}-heading`} className="mb-4 text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function EmailSection({ email }: { email: string }) {
  const t = useTranslations("settings.account.email");
  const errorText = useErrorText();
  const { state, onSubmit, pending } = useKeptForm<AccountState>(
    changeEmail,
    {},
  );
  return (
    <Section id="email" title={t("title")}>
      <p className="mb-4">
        {t("current")} <strong>{email}</strong>
      </p>
      {state.ok ? (
        <FormAlert tone="success">
          <p>{t("sent", { email: state.value ?? "" })}</p>
        </FormAlert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col items-start gap-4">
          <Field
            name="email"
            type="email"
            autoComplete="email"
            label={t("new")}
            defaultValue={state.value}
            error={errorText(state.error)}
            required
          />
          <PendingButton pending={pending} variant="quiet">
            {t("change")}
          </PendingButton>
        </form>
      )}
    </Section>
  );
}

export function PhoneSection({
  phone,
  verified,
  smsAvailable,
}: {
  phone: string | null;
  verified: boolean;
  smsAvailable: boolean;
}) {
  const t = useTranslations("settings.account.phone");
  const errorText = useErrorText();
  const change = useKeptForm<AccountState>(changePhone, {});
  const send = useKeptForm<AccountState>(requestPhoneCode, {});
  const verify = useKeptForm<AccountState>(confirmPhoneCode, {});
  const nowVerified = verified || !!verify.state.ok;

  return (
    <Section id="phone" title={t("title")}>
      <p className="mb-4 flex flex-wrap items-center gap-2">
        {phone ? (
          <>
            <span>
              {t("current")} <strong>{phone}</strong>
            </span>
            {nowVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-leaf/15 px-2.5 py-0.5 text-[0.875rem] font-semibold">
                <BadgeCheck aria-hidden size={15} className="text-leaf" />
                {t("verified")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-ring/15 px-2.5 py-0.5 text-[0.875rem] font-semibold">
                <CircleAlert aria-hidden size={15} className="text-ring" />
                {t("notVerified")}
              </span>
            )}
          </>
        ) : (
          t("none")
        )}
      </p>

      {phone && !nowVerified && smsAvailable && (
        <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl bg-mist/60 p-4">
          <p className="text-[0.9375rem]">{t("why")}</p>
          <form onSubmit={send.onSubmit}>
            <PendingButton pending={send.pending} variant="quiet">
              {send.state.ok ? t("resend") : t("sendCode")}
            </PendingButton>
          </form>
          {send.state.error && (
            <p role="alert" className="text-[0.9375rem] text-danger">
              {errorText(send.state.error)}
            </p>
          )}
          {send.state.ok && (
            <>
              <p className="text-[0.9375rem]" role="status">
                {t("codeSent", { phone })}
              </p>
              {send.state.simulatedCode && (
                <p className="rounded-lg border border-dashed border-ring px-3 py-2 text-[0.9375rem]">
                  {t("simulated", { code: send.state.simulatedCode })}
                </p>
              )}
              <form
                onSubmit={verify.onSubmit}
                className="flex flex-wrap items-end gap-3"
              >
                <Field
                  name="code"
                  label={t("code")}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  defaultValue={verify.state.value}
                  error={errorText(verify.state.error)}
                  className="max-w-36"
                />
                <PendingButton pending={verify.pending}>
                  {t("verify")}
                </PendingButton>
              </form>
            </>
          )}
        </div>
      )}
      {verify.state.ok && (
        <FormAlert tone="success">{t("verifiedNow")}</FormAlert>
      )}

      <form
        onSubmit={change.onSubmit}
        className="mt-4 flex flex-col items-start gap-4"
      >
        <Field
          name="phone"
          type="tel"
          autoComplete="tel"
          label={phone ? t("new") : t("add")}
          hint={t("hint")}
          defaultValue={change.state.value}
          error={errorText(change.state.error)}
          required
        />
        <PendingButton pending={change.pending} variant="quiet">
          {t("save")}
        </PendingButton>
        {change.state.ok && <FormAlert tone="success">{t("saved")}</FormAlert>}
      </form>
    </Section>
  );
}

export function PasswordSection() {
  const t = useTranslations("settings.account.password");
  const errorText = useErrorText();
  const { state, onSubmit, pending } = useKeptForm<AccountState>(
    changePassword,
    {},
  );
  return (
    <Section id="password" title={t("title")}>
      <form onSubmit={onSubmit} className="flex flex-col items-start gap-4">
        {state.ok && <FormAlert tone="success">{t("saved")}</FormAlert>}
        <PasswordField
          name="current"
          label={t("current")}
          autoComplete="current-password"
          error={
            state.error === "currentWrong" ? errorText(state.error) : undefined
          }
          required
        />
        <PasswordField
          name="next"
          label={t("new")}
          hint={t("hint")}
          autoComplete="new-password"
          error={
            state.error && state.error !== "currentWrong"
              ? errorText(state.error)
              : undefined
          }
          required
        />
        <PendingButton pending={pending} variant="quiet">
          {t("change")}
        </PendingButton>
      </form>
    </Section>
  );
}

export function DeleteSection() {
  const t = useTranslations("settings.account.delete");
  const errorText = useErrorText();
  const { state, onSubmit, pending } = useKeptForm<AccountState>(
    deleteAccount,
    {},
  );
  return (
    <section
      id="delete"
      aria-labelledby="delete-heading"
      className="scroll-mt-20"
    >
      <details
        className="rounded-2xl border border-danger/40 p-4"
        open={!!state.error}
      >
        <summary
          id="delete-heading"
          className="cursor-pointer font-semibold text-danger"
        >
          {t("title")}
        </summary>
        <form
          onSubmit={onSubmit}
          className="mt-4 flex flex-col items-start gap-4"
        >
          <p>{t("body")}</p>
          <ul className="list-disc ps-5 text-[0.9375rem] text-ink-soft">
            <li>{t("lose1")}</li>
            <li>{t("lose2")}</li>
            <li>{t("lose3")}</li>
          </ul>
          <PasswordField
            name="password"
            label={t("password")}
            autoComplete="current-password"
            error={
              state.error === "currentWrong"
                ? errorText(state.error)
                : undefined
            }
            required
          />
          <Field
            name="confirm"
            label={t("typeDelete")}
            autoComplete="off"
            error={
              state.error === "typeDelete" ? errorText(state.error) : undefined
            }
            required
          />
          {state.error === "generic" && (
            <FormAlert tone="error">{errorText("generic")}</FormAlert>
          )}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-danger px-6 font-semibold text-paper hover:opacity-90 disabled:opacity-60"
          >
            <Trash2 aria-hidden size={18} />
            {t("button")}
          </button>
        </form>
      </details>
    </section>
  );
}
