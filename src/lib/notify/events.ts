import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "./notify";

/** The other member of a connection, and the actor's first name. */
async function pair(connectionId: string, actorId: string) {
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("connections")
    .select("user_a, user_b, ended_at")
    .eq("id", connectionId)
    .single();
  if (!c || c.ended_at) return null;
  const other = c.user_a === actorId ? c.user_b : c.user_a;
  const { data: p } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", actorId)
    .single();
  return { other, name: p?.display_name ?? "" };
}

/**
 * Sends notes after the response has gone back, so they never slow down
 * the member who caused them.
 */
function later(work: () => Promise<void>) {
  after(async () => {
    try {
      await work();
    } catch (e) {
      console.error("notification failed", e);
    }
  });
}

export function onNewMessage(connectionId: string, senderId: string) {
  later(async () => {
    const p = await pair(connectionId, senderId);
    if (p) {
      await notify(p.other, {
        topic: "messages",
        ref: connectionId,
        name: p.name,
        path: `/chat/${connectionId}`,
        kind: "new",
      });
    }
  });
}

export function onConnected(connectionId: string, chooserId: string) {
  later(async () => {
    const p = await pair(connectionId, chooserId);
    if (p) {
      await notify(p.other, {
        topic: "connections",
        ref: connectionId,
        name: p.name,
        path: `/chat/${connectionId}`,
        kind: "new",
      });
    }
  });
}

export function onJourney(
  connectionId: string,
  actorId: string,
  kind: "proposed" | "accepted" | "level",
) {
  later(async () => {
    const p = await pair(connectionId, actorId);
    if (p) {
      await notify(p.other, {
        topic: "journey",
        ref: connectionId,
        name: p.name,
        path: `/together/${connectionId}`,
        kind,
      });
    }
  });
}
