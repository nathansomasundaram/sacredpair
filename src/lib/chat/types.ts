// Shared by the server and the browser: plain shapes only.

export const MESSAGE_MAX = 2000;
/** How many messages a conversation shows at first, and per "show earlier". */
export const PAGE_SIZE = 50;

export type ChatMessage = {
  id: number;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type MessageRow = {
  id: number | string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export const toMessage = (r: MessageRow): ChatMessage => ({
  id: Number(r.id),
  senderId: r.sender_id,
  body: r.body,
  createdAt: r.created_at,
  readAt: r.read_at,
});

/**
 * Adds or updates messages, keeping them in order. Used for messages that
 * arrive live, from the periodic check, and the member's own sends.
 */
export function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  let changed = false;
  for (const m of incoming) {
    const old = byId.get(m.id);
    if (!old || old.readAt !== m.readAt || old.body !== m.body) {
      byId.set(m.id, m);
      changed = true;
    }
  }
  if (!changed) return current;
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export type SendError =
  "empty" | "tooLong" | "rateLimited" | "closed" | "failed";
