import "server-only";
import { createTranslator } from "next-intl";
import { defaultLocale } from "@/i18n/config";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import {
  sendEmail,
  sendPush,
  sendSms,
  smsAvailable,
  type Delivery,
} from "./providers";

export type Topic = "messages" | "connections" | "journey";
type Channel = "email" | "push" | "sms";

/**
 * How long to wait before sending the same kind of note about the same
 * thing again. A busy conversation shouldn't send an email per message.
 */
const QUIET_MINUTES: Record<Topic, Record<Channel, number>> = {
  messages: { push: 0, email: 60, sms: 60 },
  connections: { push: 0, email: 0, sms: 0 },
  journey: { push: 10, email: 60, sms: 60 },
};

type Note = {
  topic: Topic;
  /** What it's about (a conversation, a journey), for the quiet period. */
  ref: string;
  /** The other person's first name. */
  name: string;
  /** Where the note should take them, for example /chat/<id>. */
  path: string;
  /** Message key under notify.<topic>. */
  kind: string;
};

/**
 * Tells a member something happened, by every channel they turned on for
 * that kind of news. Never throws: a failed note mustn't fail the action
 * that caused it. Notes never include message text, so nothing private
 * appears on a lock screen or in an inbox preview.
 */
export async function notify(userId: string, note: Note): Promise<void> {
  try {
    await deliver(userId, note);
  } catch (e) {
    console.error("notify failed", e);
  }
}

async function deliver(userId: string, note: Note) {
  const admin = createAdminClient();
  const [{ data: prefs }, { data: priv }, { data: subs }, { data: user }] =
    await Promise.all([
      admin
        .from("preferences")
        .select(
          "notify_email, notify_push, notify_sms, notify_messages, notify_connections, notify_journey",
        )
        .eq("profile_id", userId)
        .single(),
      admin
        .from("account_private")
        .select("phone, phone_verified_at")
        .eq("user_id", userId)
        .single(),
      admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId),
      admin.auth.admin.getUserById(userId),
    ]);
  if (!prefs || !prefs[`notify_${note.topic}`]) return;

  // Runs after the response (no request to read a language from), so the
  // wording is loaded directly. Members' languages arrive with translations.
  const messages = (await import(`../../../messages/${defaultLocale}.json`))
    .default;
  const tCommon = createTranslator({
    locale: defaultLocale,
    messages,
    namespace: "notify",
  });
  const t = (key: string, values: { name: string }) =>
    tCommon(`${note.topic}.${key}` as Parameters<typeof tCommon>[0], values);
  const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}${note.path}`;
  const title = t(`${note.kind}.title`, { name: note.name });
  const body = t(`${note.kind}.body`, { name: note.name });

  /** Claims a send (null if one went out too recently), then records how it went. */
  const claim = async (channel: Channel) => {
    const { data, error } = await admin.rpc("claim_notification", {
      p_user: userId,
      p_channel: channel,
      p_topic: note.topic,
      p_ref: note.ref,
      p_quiet_minutes: QUIET_MINUTES[note.topic][channel],
    });
    if (error) throw error;
    return (data as number | null) ?? null;
  };
  const record = (id: number, status: Delivery | "failed", detail = "") =>
    admin.from("notification_log").update({ status, detail }).eq("id", id);

  const jobs: Promise<unknown>[] = [];

  const pushId =
    prefs.notify_push && (subs?.length ?? 0) > 0 ? await claim("push") : null;
  if (pushId) {
    jobs.push(
      (async () => {
        let delivered: Delivery | null = null;
        for (const s of subs!) {
          try {
            const r = await sendPush(s, {
              title,
              body,
              url: note.path,
              tag: `${note.topic}:${note.ref}`,
            });
            if (r === "gone")
              await admin.from("push_subscriptions").delete().eq("id", s.id);
            else delivered = delivered === "sent" ? "sent" : r;
          } catch (e) {
            console.error("push failed", e);
          }
        }
        await record(pushId, delivered ?? "failed");
      })(),
    );
  }

  const email = user?.user?.email;
  const emailId = prefs.notify_email && email ? await claim("email") : null;
  if (emailId) {
    jobs.push(
      (async () => {
        try {
          const action = tCommon("open");
          const footer = tCommon("footer");
          const text = `${body}\n\n${action}: ${url}\n\n${footer}`;
          const html = emailHtml(title, body, action, url, footer);
          await record(emailId, await sendEmail(email!, title, text, html));
        } catch (e) {
          await record(emailId, "failed", String(e).slice(0, 200));
        }
      })(),
    );
  }

  const phone = priv?.phone_verified_at ? priv.phone : null;
  const smsId =
    prefs.notify_sms && phone && smsAvailable() ? await claim("sms") : null;
  if (smsId) {
    jobs.push(
      (async () => {
        try {
          await record(
            smsId,
            await sendSms(phone!, `Sacred Pair: ${body} ${url}`),
          );
        } catch (e) {
          await record(smsId, "failed", String(e).slice(0, 200));
        }
      })(),
    );
  }

  await Promise.all(jobs);
}

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

function emailHtml(
  title: string,
  body: string,
  action: string,
  url: string,
  footer: string,
) {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#fafafc;font-family:Arial,Helvetica,sans-serif;color:#1e2340;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #d9d6e6;border-radius:16px;"><tr><td style="padding:36px 32px;">
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px;color:#4a3d8f;">Sacred Pair</p>
<h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:24px;">${esc(title)}</h1>
<p style="margin:0 0 24px;font-size:17px;line-height:1.6;">${esc(body)}</p>
<p style="margin:0 0 28px;"><a href="${esc(url)}" style="display:inline-block;background:#4a3d8f;color:#fff;text-decoration:none;font-weight:bold;font-size:17px;padding:14px 28px;border-radius:999px;">${esc(action)}</a></p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#4f5575;">${esc(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}
