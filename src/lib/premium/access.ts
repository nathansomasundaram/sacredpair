import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether a connection can use Chat and Together, which need Premium for
 * both people:
 *   open     both have Premium
 *   upgrade  the signed-in member doesn't
 *   waiting  they do, the other person doesn't (yet)
 */
export type Access = "open" | "upgrade" | "waiting";

/** Access for each of the signed-in member's live connections. */
export async function getConnectionAccess(): Promise<Map<string, Access>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_connection_access");
  if (error) throw error;
  return new Map(
    ((data ?? []) as { connection_id: string; access: Access }[]).map((r) => [
      r.connection_id,
      r.access,
    ]),
  );
}

/** Access for one connection; "open" for an ended one (nothing to unlock). */
export async function accessFor(connectionId: string): Promise<Access> {
  return (await getConnectionAccess()).get(connectionId) ?? "open";
}
