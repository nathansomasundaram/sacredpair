import "server-only";
import {
  getProfileOverview,
  getProfileOverviews,
  signedPhotoUrl,
  signedPhotoUrls,
  type ProfileOverview,
} from "@/lib/profile/data";
import { createClient } from "@/lib/supabase/server";
import {
  PAGE_SIZE,
  toMessage,
  type ChatMessage,
  type MessageRow,
} from "./types";

export type ConversationSummary = {
  connectionId: string;
  other: ProfileOverview;
  photoUrl: string | null;
  connectedAt: string;
  last: { body: string; mine: boolean; at: string } | null;
  unread: number;
};

/** The Chat list: live conversations, most recent first. */
export async function getConversations(
  me: string,
): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_conversations");
  if (error) throw error;
  const rows = (data ?? []) as {
    connection_id: string;
    other_id: string;
    connected_at: string;
    last_body: string | null;
    last_sender_id: string | null;
    last_at: string | null;
    unread: number;
  }[];
  const profiles = await getProfileOverviews(rows.map((r) => r.other_id));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const urls = await signedPhotoUrls(profiles.map((p) => p.photoPath));

  return rows.flatMap((r) => {
    const other = byId.get(r.other_id);
    if (!other) return [];
    return [
      {
        connectionId: r.connection_id,
        other,
        photoUrl: other.photoPath ? (urls.get(other.photoPath) ?? null) : null,
        connectedAt: r.connected_at,
        last:
          r.last_body !== null && r.last_at
            ? {
                body: r.last_body,
                mine: r.last_sender_id === me,
                at: r.last_at,
              }
            : null,
        unread: r.unread,
      },
    ];
  });
}

export type Conversation = {
  connectionId: string;
  active: boolean;
  other: ProfileOverview;
  photoUrl: string | null;
  messages: ChatMessage[];
  hasEarlier: boolean;
};

/**
 * One conversation for a member of it, or null if they aren't (Row Level
 * Security only shows members their own connections).
 */
export async function getConversation(
  me: string,
  connectionId: string,
): Promise<Conversation | null> {
  const supabase = await createClient();
  const { data: c, error } = await supabase
    .from("connections")
    .select("id, user_a, user_b, ended_at")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw error;
  if (!c) return null;

  const otherId = c.user_a === me ? c.user_b : c.user_a;
  const other = await getProfileOverview(otherId);
  if (!other) return null;

  const page = c.ended_at
    ? { messages: [], hasEarlier: false }
    : await getMessages(connectionId);
  return {
    connectionId,
    active: !c.ended_at,
    other,
    photoUrl: await signedPhotoUrl(other.photoPath),
    ...page,
  };
}

/** Messages in order, the latest page or the page before a given message. */
export async function getMessages(
  connectionId: string,
  beforeId?: number,
): Promise<{ messages: ChatMessage[]; hasEarlier: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("messages")
    .select("id, sender_id, body, created_at, read_at")
    .eq("connection_id", connectionId)
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (beforeId) query = query.lt("id", beforeId);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as MessageRow[];
  return {
    messages: rows.slice(0, PAGE_SIZE).map(toMessage).reverse(),
    hasEarlier: rows.length > PAGE_SIZE,
  };
}

/** Total unread messages across all conversations. */
export async function getUnreadTotal(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_conversations");
  if (error) return 0;
  return ((data ?? []) as { unread: number }[]).reduce(
    (n, r) => n + r.unread,
    0,
  );
}
