"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVerifiedMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { STORY_MAX, STORY_MIN } from "./limits";

export type StoryState = {
  ok?: boolean;
  error?: "body" | "name" | "consent" | "tooMany" | "failed";
  values?: { displayName: string; partnerName: string; place: string; body: string };
};


const storySchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  partnerName: z.string().trim().max(40),
  place: z.string().trim().max(60),
  body: z.string().trim().min(STORY_MIN).max(STORY_MAX),
  consent: z.literal("on"),
});

/** Sends a story to the team for review. Nothing is published without approval. */
export async function submitStory(_prev: StoryState, formData: FormData): Promise<StoryState> {
  const user = await requireVerifiedMember("/settings/story");
  const values = {
    displayName: String(formData.get("displayName") ?? ""),
    partnerName: String(formData.get("partnerName") ?? ""),
    place: String(formData.get("place") ?? ""),
    body: String(formData.get("body") ?? ""),
  };
  const parsed = storySchema.safeParse({ ...values, consent: formData.get("consent") });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const error = field === "consent" ? "consent" : field === "displayName" ? "name" : "body";
    return { error, values };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("stories").insert({
    author_id: user.id,
    display_name: v.displayName,
    partner_name: v.partnerName,
    place: v.place,
    body: v.body,
  });
  if (error) {
    if (error.message.includes("too_many_pending")) return { error: "tooMany", values };
    console.error("submitStory failed", error);
    return { error: "failed", values };
  }
  revalidatePath("/settings/story");
  return { ok: true };
}

/** Withdraws a story; if it was published, it comes down. */
export async function withdrawStory(formData: FormData) {
  await requireVerifiedMember("/settings/story");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("stories").delete().eq("id", id);
  revalidatePath("/settings/story");
  revalidatePath("/stories");
  revalidatePath("/");
}
