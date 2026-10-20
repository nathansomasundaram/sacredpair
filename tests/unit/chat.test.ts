import { describe, expect, it } from "vitest";
import { mergeMessages, toMessage, type ChatMessage } from "@/lib/chat/types";
import messages from "../../messages/en-US.json";

const msg = (id: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  senderId: "a",
  body: `Message ${id}`,
  createdAt: new Date(2026, 9, 20, 9, id).toISOString(),
  readAt: null,
  ...extra,
});

describe("merging messages", () => {
  it("adds new messages in order, whichever way they arrive", () => {
    const merged = mergeMessages([msg(1), msg(3)], [msg(4), msg(2)]);
    expect(merged.map((m) => m.id)).toEqual([1, 2, 3, 4]);
  });

  it("ignores a message it already has (live update and send reply both bring it)", () => {
    const current = [msg(1), msg(2)];
    expect(mergeMessages(current, [msg(2)])).toBe(current);
  });

  it("updates read receipts", () => {
    const read = "2026-10-20T13:00:00Z";
    const merged = mergeMessages([msg(1), msg(2)], [msg(2, { readAt: read })]);
    expect(merged[1].readAt).toBe(read);
  });

  it("reads rows from the database, including ids sent as text", () => {
    expect(
      toMessage({
        id: "42",
        sender_id: "b",
        body: "Hi",
        created_at: "x",
        read_at: null,
      }),
    ).toEqual({
      id: 42,
      senderId: "b",
      body: "Hi",
      createdAt: "x",
      readAt: null,
    });
  });
});

describe("wording", () => {
  it("covers every send error and report reason", () => {
    for (const e of ["empty", "tooLong", "rateLimited", "closed", "failed"]) {
      expect(messages.chat.sendError).toHaveProperty(e);
    }
    for (const r of [
      "harassment",
      "inappropriate_content",
      "scam",
      "fake_profile",
      "underage",
      "other",
    ]) {
      expect(messages.safety.reasons).toHaveProperty(r);
    }
  });
});
