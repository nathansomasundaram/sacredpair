import "server-only";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

export type Delivery = "sent" | "simulated";

/* ----------------------------------------------------------------- email */

let transport: nodemailer.Transporter | undefined;

/** Sends an email over SMTP, or just logs it if no SMTP server is set up. */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<Delivery> {
  const { SMTP_URL, EMAIL_FROM } = serverEnv();
  if (!SMTP_URL) {
    console.info(
      `[email not sent: SMTP_URL isn't set] to=${to} subject=${subject}`,
    );
    return "simulated";
  }
  transport ??= nodemailer.createTransport(SMTP_URL);
  await transport.sendMail({ from: EMAIL_FROM, to, subject, text, html });
  return "sent";
}

/* ------------------------------------------------------------------ push */

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export const pushConfigured = () =>
  !!(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && serverEnv().VAPID_PRIVATE_KEY);

/**
 * Sends a web push notification. Returns "gone" when the browser has
 * dropped the subscription, so the caller can forget that device.
 */
export async function sendPush(
  target: PushTarget,
  payload: { title: string; body: string; url: string; tag: string },
): Promise<Delivery | "gone"> {
  const env = serverEnv();
  if (!pushConfigured()) return "simulated";
  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24,
        vapidDetails: {
          subject: env.VAPID_SUBJECT,
          publicKey: publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          privateKey: env.VAPID_PRIVATE_KEY!,
        },
      },
    );
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    throw e;
  }
}

/* ------------------------------------------------------------------- sms */

export const smsAvailable = () => serverEnv().SMS_PROVIDER !== "none";
export const smsSimulated = () => serverEnv().SMS_PROVIDER === "simulated";

/** Sends a text message through Twilio, or logs it in simulated mode. */
export async function sendSms(to: string, body: string): Promise<Delivery> {
  const env = serverEnv();
  if (env.SMS_PROVIDER === "none")
    throw new Error("Text messages aren't set up");
  if (env.SMS_PROVIDER === "simulated") {
    console.info(`[text not sent: simulated] to=${to} body=${body}`);
    return "simulated";
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: env.TWILIO_FROM_NUMBER!,
        Body: body,
      }),
    },
  );
  if (!res.ok) throw new Error(`Twilio returned ${res.status}`);
  return "sent";
}
