import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ConnectState = {
  /** The member's own choice about this person; never the other way round. */
  choice: "chosen" | "passed" | null;
  /** The connection between them, if one ever opened. */
  connection: { id: string; active: boolean } | null;
};

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * Connect state for several people at once: the member's own choices and
 * any connections. Row Level Security means a member only ever sees their
 * own choices, so a one-sided choice stays private.
 */
export async function getConnectStates(
  me: string,
  others: string[],
): Promise<Map<string, ConnectState>> {
  const states = new Map<string, ConnectState>(
    others.map((id) => [id, { choice: null, connection: null }]),
  );
  if (others.length === 0) return states;
  const supabase = await createClient();

  const [choices, connections] = await Promise.all([
    supabase
      .from("choices")
      .select("to_id, chosen")
      .eq("from_id", me)
      .in("to_id", others),
    supabase
      .from("connections")
      .select("id, user_a, user_b, ended_at, created_at")
      .or(`user_a.eq.${me},user_b.eq.${me}`)
      .order("created_at", { ascending: true }),
  ]);
  if (choices.error) throw choices.error;
  if (connections.error) throw connections.error;

  for (const c of choices.data ?? []) {
    const s = states.get(c.to_id);
    if (s) s.choice = c.chosen ? "chosen" : "passed";
  }
  const wanted = new Map(others.map((id) => [pairKey(me, id), id]));
  for (const c of connections.data ?? []) {
    const other = wanted.get(pairKey(c.user_a, c.user_b));
    const s = other ? states.get(other) : undefined;
    // Later rows win, so the newest connection is the one shown.
    if (s) s.connection = { id: c.id, active: !c.ended_at };
  }
  return states;
}

export async function getConnectState(me: string, other: string) {
  return (await getConnectStates(me, [other])).get(other)!;
}

/** Everyone the member is connected with now, newest first. */
export async function getActiveConnections(
  me: string,
): Promise<{ id: string; otherId: string; since: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .select("id, user_a, user_b, created_at")
    .is("ended_at", null)
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    otherId: c.user_a === me ? c.user_b : c.user_a,
    since: c.created_at,
  }));
}
