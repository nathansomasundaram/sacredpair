"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getConnectState } from "@/lib/connect/data";
import { createClient } from "@/lib/supabase/server";
import { REPORT_DETAILS_MAX, REPORT_REASONS } from "./reasons";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where to go afterwards: back to Chat if the member came from there. */
const doneUrl = (fromChat: boolean, notice: string) =>
  `${fromChat ? "/chat" : "/details"}?notice=${notice}`;

function revalidateLists() {
  revalidatePath("/chat");
  revalidatePath("/details");
  revalidatePath("/discover");
}

async function block(me: string, other: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: me, blocked_id: other });
  // Already blocked is fine.
  if (error && error.code !== "23505") throw error;
}

export type ReportState = {
  error?: "reason" | "details" | "failed";
  /** What the member entered, so a correction doesn't start over. */
  values?: { reason: string; details: string; alsoBlock: boolean };
};

const reportSchema = z.object({
  profileId: z.string().regex(UUID),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX),
  alsoBlock: z.string().nullish(),
  fromChat: z.string().nullish(),
});

/**
 * Files a report for the moderation team, tied to the conversation if the
 * two were ever connected, and optionally blocks the person too. The person
 * reported is never told who reported them.
 */
export async function reportMember(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const values = {
    reason: String(formData.get("reason") ?? ""),
    details: String(formData.get("details") ?? ""),
    alsoBlock: !!formData.get("alsoBlock"),
  };
  const parsed = reportSchema.safeParse({
    profileId: formData.get("profileId"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? "",
    alsoBlock: formData.get("alsoBlock"),
    fromChat: formData.get("fromChat"),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "details" ? "details" : "reason", values };
  }
  const { profileId, reason, details, alsoBlock, fromChat } = parsed.data;
  if (reason === "other" && !details) return { error: "details", values };

  const user = await requireVerifiedMember(`/safety/${profileId}`);
  const state = await getConnectState(user.id, profileId);
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_id: profileId,
    reason,
    details,
    connection_id: state.connection?.id ?? null,
  });
  // 23505: they already have an open report about this person.
  if (error && error.code !== "23505") {
    console.error("reportMember failed", error);
    return { error: "failed", values };
  }

  if (alsoBlock) await block(user.id, profileId);
  revalidateLists();
  redirect(doneUrl(!!fromChat, alsoBlock ? "reportedBlocked" : "reported"));
}

/** Blocks someone: ends any connection, and neither sees the other again. */
export async function blockMember(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  if (!UUID.test(profileId)) redirect("/details");
  const user = await requireVerifiedMember(`/safety/${profileId}`);
  await block(user.id, profileId);
  revalidateLists();
  redirect(doneUrl(!!formData.get("fromChat"), "blocked"));
}

/** Ends a connection: the conversation closes for both, for good. */
export async function endConnection(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  if (!UUID.test(profileId)) redirect("/details");
  const user = await requireVerifiedMember(`/safety/${profileId}`);
  const state = await getConnectState(user.id, profileId);
  if (state.connection?.active) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("connections")
      .update({ ended_at: new Date().toISOString(), ended_by: user.id })
      .eq("id", state.connection.id);
    if (error) throw error;
  }
  revalidateLists();
  redirect(doneUrl(!!formData.get("fromChat"), "ended"));
}
