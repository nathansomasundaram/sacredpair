"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, requireVerifiedMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isPath, LEVEL_COUNT } from "./content";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ids(formData: FormData) {
  const connectionId = String(formData.get("connectionId") ?? "");
  const journeyId = String(formData.get("journeyId") ?? "");
  if (!UUID.test(connectionId)) redirect("/together");
  return { connectionId, journeyId: UUID.test(journeyId) ? journeyId : null };
}

const done = (connectionId: string, notice: string): never => {
  revalidatePath("/together");
  redirect(`/together/${connectionId}?notice=${notice}`);
};

/** Suggests a path. The other person accepts it, or suggests another. */
export async function proposePath(formData: FormData) {
  const { connectionId } = ids(formData);
  const path = formData.get("path");
  if (!isPath(path)) redirect(`/together/${connectionId}`);
  const user = await requireVerifiedMember(`/together/${connectionId}`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("journeys")
    .insert({ connection_id: connectionId, path, proposed_by: user.id });
  // 23505: one open journey per connection; the other person got there first.
  if (error)
    done(connectionId, error.code === "23505" ? "alreadyOpen" : "failed");
  done(connectionId, "proposed");
}

/** Accepts the path the other person suggested; the journey begins. */
export async function acceptPath(formData: FormData) {
  const { connectionId, journeyId } = ids(formData);
  await requireVerifiedMember(`/together/${connectionId}`);
  if (!journeyId) redirect(`/together/${connectionId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_journey", { jid: journeyId });
  if (error) done(connectionId, "failed");
  done(connectionId, "accepted");
}

/**
 * Closes the open journey: withdrawing or declining a suggestion, or
 * leaving a path partway. Either person can then suggest a new path.
 */
export async function closePath(formData: FormData) {
  const { connectionId, journeyId } = ids(formData);
  await requireVerifiedMember(`/together/${connectionId}`);
  if (!journeyId) redirect(`/together/${connectionId}`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("journeys")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", journeyId)
    .is("ended_at", null);
  if (error) done(connectionId, "failed");
  done(connectionId, String(formData.get("reason") ?? "closed"));
}

export type CompleteResult =
  | { ok: true }
  | { ok: false; error: "waitForPartner" | "locked" | "notActive" | "failed" };

/** Records a finished level. The database checks the order rules. */
export async function completeLevel(
  connectionId: string,
  journeyId: string,
  level: number,
  score: number,
): Promise<CompleteResult> {
  const user = await getSessionUser();
  if (!user?.idVerified) return { ok: false, error: "notActive" };
  if (
    !UUID.test(journeyId) ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > LEVEL_COUNT
  ) {
    return { ok: false, error: "failed" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_level", {
    p_journey: journeyId,
    p_level: level,
    p_score: Math.max(0, Math.min(100, Math.round(score))),
  });
  if (error) {
    if (error.message.includes("wait_for_partner"))
      return { ok: false, error: "waitForPartner" };
    if (error.message.includes("level_locked"))
      return { ok: false, error: "locked" };
    if (error.message.includes("journey_not_active"))
      return { ok: false, error: "notActive" };
    console.error("completeLevel failed", error);
    return { ok: false, error: "failed" };
  }
  revalidatePath("/together");
  revalidatePath(`/together/${connectionId}`);
  return { ok: true };
}
