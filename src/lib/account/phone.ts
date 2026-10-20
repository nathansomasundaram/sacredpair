import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { sendSms, smsAvailable, smsSimulated } from "@/lib/notify/providers";
import { createAdminClient } from "@/lib/supabase/server";

const CODE_MINUTES = 10;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;

const hash = (userId: string, code: string) =>
  createHash("sha256").update(`${userId}:${code}`).digest("hex");

export type SendCodeResult =
  | { ok: true; simulatedCode?: string }
  | {
      ok: false;
      error:
        "noPhone" | "alreadyVerified" | "tooSoon" | "unavailable" | "failed";
    };

/**
 * Texts a 6-digit code to the member's phone number. In simulated mode
 * (local and previews only) the code is returned so it can be shown on
 * screen instead.
 */
export async function sendPhoneCode(userId: string): Promise<SendCodeResult> {
  if (!smsAvailable()) return { ok: false, error: "unavailable" };
  const admin = createAdminClient();
  const { data: priv } = await admin
    .from("account_private")
    .select("phone, phone_verified_at")
    .eq("user_id", userId)
    .single();
  if (!priv?.phone) return { ok: false, error: "noPhone" };
  if (priv.phone_verified_at) return { ok: false, error: "alreadyVerified" };

  const { data: last } = await admin
    .from("phone_codes")
    .select("sent_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (
    last &&
    Date.now() - new Date(last.sent_at).getTime() < RESEND_SECONDS * 1000
  ) {
    return { ok: false, error: "tooSoon" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await admin.from("phone_codes").upsert(
    {
      user_id: userId,
      phone: priv.phone,
      code_hash: hash(userId, code),
      attempts: 0,
      expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(),
      sent_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: "failed" };

  try {
    const status = await sendSms(
      priv.phone,
      `Your Sacred Pair code is ${code}. It expires in ${CODE_MINUTES} minutes.`,
    );
    await admin
      .from("notification_log")
      .insert({ user_id: userId, channel: "sms", topic: "phone_code", status });
  } catch (e) {
    console.error("sendPhoneCode failed", e);
    return { ok: false, error: "failed" };
  }
  return smsSimulated() ? { ok: true, simulatedCode: code } : { ok: true };
}

export type VerifyCodeResult =
  { ok: true } | { ok: false; error: "wrong" | "expired" | "tooMany" };

/** Checks a code; on success the phone number counts as verified. */
export async function verifyPhoneCode(
  userId: string,
  code: string,
): Promise<VerifyCodeResult> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("phone_codes")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: priv } = await admin
    .from("account_private")
    .select("phone")
    .eq("user_id", userId)
    .single();
  if (
    !row ||
    !priv ||
    row.phone !== priv.phone ||
    new Date(row.expires_at).getTime() < Date.now()
  ) {
    return { ok: false, error: "expired" };
  }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "tooMany" };

  const given = Buffer.from(hash(userId, code.trim()));
  const expected = Buffer.from(row.code_hash);
  if (
    !/^\d{6}$/.test(code.trim()) ||
    given.length !== expected.length ||
    !timingSafeEqual(given, expected)
  ) {
    await admin
      .from("phone_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("user_id", userId);
    return {
      ok: false,
      error: row.attempts + 1 >= MAX_ATTEMPTS ? "tooMany" : "wrong",
    };
  }

  await admin
    .from("account_private")
    .update({ phone_verified_at: new Date().toISOString() })
    .eq("user_id", userId);
  await admin.from("phone_codes").delete().eq("user_id", userId);
  return { ok: true };
}
