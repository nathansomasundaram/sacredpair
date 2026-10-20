"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser, requireVerifiedMember } from "@/lib/auth/session";
import { pushConfigured, sendPush } from "@/lib/notify/providers";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type NotifyState = { saved?: boolean; error?: "failed" };

/** Saves how (email, push, text) and what (messages, ...) to be told about. */
export async function saveNotifications(
  _prev: NotifyState,
  formData: FormData,
): Promise<NotifyState> {
  const user = await requireVerifiedMember("/settings/notifications");
  const on = (k: string) => formData.get(k) === "on";
  const supabase = await createClient();
  const { error } = await supabase
    .from("preferences")
    .update({
      notify_email: on("email"),
      notify_push: on("push"),
      notify_sms: on("sms"),
      notify_messages: on("messages"),
      notify_connections: on("connections"),
      notify_journey: on("journey"),
      marketing_emails: on("marketing"),
    })
    .eq("profile_id", user.id);
  if (error) {
    console.error("saveNotifications failed", error);
    return { error: "failed" };
  }
  revalidatePath("/settings/notifications");
  return { saved: true };
}

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

/** Remembers this browser for push notifications. */
export async function savePushSubscription(
  sub: unknown,
  userAgent: string,
): Promise<boolean> {
  const user = await getSessionUser();
  if (!user?.idVerified) return false;
  const parsed = subscriptionSchema.safeParse(sub);
  if (!parsed.success) return false;
  const admin = createAdminClient();
  // The same browser may have been used by someone else before.
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint);
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) console.error("savePushSubscription failed", error);
  return !error;
}

/** Forgets this browser for push notifications. */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
}

/** Sends a test notification to this browser. */
export async function sendTestPush(
  endpoint: string,
): Promise<"sent" | "notConfigured" | "failed"> {
  const user = await getSessionUser();
  if (!user) return "failed";
  if (!pushConfigured()) return "notConfigured";
  const supabase = await createClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("endpoint", endpoint)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return "failed";
  try {
    const r = await sendPush(data, {
      title: "Sacred Pair",
      body: "Push notifications are working on this device.",
      url: "/settings/notifications",
      tag: "test",
    });
    return r === "sent" ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
