"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { onNewMessage } from "@/lib/notify/events";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "./data";
import {
  MESSAGE_MAX,
  toMessage,
  type ChatMessage,
  type MessageRow,
  type SendError,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function member() {
  const user = await getSessionUser();
  if (!user?.idVerified) throw new Error("Not signed in");
  return user;
}

/**
 * Sends a message. The database checks that the sender is one of the two
 * members of a live connection and enforces the rate limit.
 */
export async function sendMessage(
  connectionId: string,
  body: string,
): Promise<
  { ok: true; message: ChatMessage } | { ok: false; error: SendError }
> {
  const user = await member();
  const text = body.trim();
  if (!UUID.test(connectionId)) return { ok: false, error: "closed" };
  if (!text) return { ok: false, error: "empty" };
  if (text.length > MESSAGE_MAX) return { ok: false, error: "tooLong" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ connection_id: connectionId, sender_id: user.id, body: text })
    .select("id, sender_id, body, created_at, read_at")
    .single();
  if (error) {
    if (error.message.includes("rate_limited"))
      return { ok: false, error: "rateLimited" };
    // Row Level Security: the connection ended or isn't theirs.
    if (
      error.code === "42501" ||
      error.message.includes("row-level security")
    ) {
      return { ok: false, error: "closed" };
    }
    console.error("sendMessage failed", error);
    return { ok: false, error: "failed" };
  }
  revalidatePath("/chat");
  onNewMessage(connectionId, user.id);
  return { ok: true, message: toMessage(data as MessageRow) };
}

/** Marks the other person's messages read (shows them "Read"). */
export async function markRead(connectionId: string): Promise<void> {
  await member();
  if (!UUID.test(connectionId)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_messages_read", {
    cid: connectionId,
  });
  if (error && !error.message.includes("not a member")) {
    console.error("markRead failed", error);
  }
}

/**
 * For when live updates aren't available (some networks block them): the
 * latest messages with their read state, and whether the conversation is
 * still open.
 */
export async function syncConversation(
  connectionId: string,
): Promise<{ active: boolean; messages: ChatMessage[] }> {
  await member();
  if (!UUID.test(connectionId)) return { active: false, messages: [] };
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("connections")
    .select("ended_at")
    .eq("id", connectionId)
    .maybeSingle();
  if (!c || c.ended_at) return { active: false, messages: [] };
  const { messages } = await getMessages(connectionId);
  return { active: true, messages };
}

/** "Show earlier messages". */
export async function loadEarlier(
  connectionId: string,
  beforeId: number,
): Promise<{ messages: ChatMessage[]; hasEarlier: boolean }> {
  await member();
  if (!UUID.test(connectionId) || !Number.isInteger(beforeId)) {
    return { messages: [], hasEarlier: false };
  }
  return getMessages(connectionId, beforeId);
}
