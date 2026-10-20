"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireVerifiedMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getConnectState } from "./data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Records the member's choice about someone: "choose" or "pass". Choices are
 * private; if the other person has chosen them too, the database opens a
 * connection and both can chat. Either choice can be changed until then.
 */
export async function setChoice(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const decision = formData.get("decision");
  if (!UUID.test(profileId) || (decision !== "choose" && decision !== "pass")) {
    redirect("/details");
  }
  const user = await requireVerifiedMember(`/details/${profileId}`);

  const before = await getConnectState(user.id, profileId);
  if (before.connection) redirect(`/details/${profileId}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("choices")
    .upsert(
      { from_id: user.id, to_id: profileId, chosen: decision === "choose" },
      { onConflict: "from_id,to_id" },
    );
  if (error) {
    // Row Level Security refused: not someone this member may choose.
    console.error("setChoice failed", error);
    redirect(`/details/${profileId}?notice=choiceFailed`);
  }

  revalidatePath("/details");
  revalidatePath("/chat");
  const after = await getConnectState(user.id, profileId);
  const notice = after.connection?.active
    ? "connected"
    : decision === "choose"
      ? "chosen"
      : "passed";
  redirect(`/details/${profileId}?notice=${notice}`);
}
