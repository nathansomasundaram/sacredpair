import "server-only";
import { getActiveConnections } from "@/lib/connect/data";
import {
  getProfileOverviews,
  signedPhotoUrls,
  type ProfileOverview,
} from "@/lib/profile/data";
import { createClient } from "@/lib/supabase/server";
import { isPath, type PathCode } from "./content";

export type Journey = {
  id: string;
  path: PathCode;
  proposedByMe: boolean;
  accepted: boolean;
};

export type Couple = {
  connectionId: string;
  other: ProfileOverview;
  photoUrl: string | null;
  journey: Journey | null;
  /** Levels finished by the member, and by their partner. */
  mine: number;
  theirs: number;
};

/**
 * The member's connections with their open journeys and progress. Row Level
 * Security limits everything here to the member's own connections.
 */
export async function getCouples(
  me: string,
  onlyConnection?: string,
): Promise<Couple[]> {
  let connections = await getActiveConnections(me);
  if (onlyConnection)
    connections = connections.filter((c) => c.id === onlyConnection);
  if (connections.length === 0) return [];

  const supabase = await createClient();
  const { data: journeys, error } = await supabase
    .from("journeys")
    .select("id, connection_id, path, proposed_by, accepted_at")
    .in(
      "connection_id",
      connections.map((c) => c.id),
    )
    .is("ended_at", null);
  if (error) throw error;

  const journeyIds = (journeys ?? []).map((j) => j.id);
  const { data: progress, error: progressError } = journeyIds.length
    ? await supabase
        .from("journey_progress")
        .select("journey_id, user_id, level")
        .in("journey_id", journeyIds)
    : { data: [], error: null };
  if (progressError) throw progressError;

  const profiles = await getProfileOverviews(connections.map((c) => c.otherId));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const urls = await signedPhotoUrls(profiles.map((p) => p.photoPath));

  return connections.flatMap((c) => {
    const other = byId.get(c.otherId);
    if (!other) return [];
    const j = (journeys ?? []).find(
      (x) => x.connection_id === c.id && isPath(x.path),
    );
    const rows = j ? (progress ?? []).filter((p) => p.journey_id === j.id) : [];
    const count = (uid: string) =>
      rows
        .filter((p) => p.user_id === uid)
        .reduce((n, p) => Math.max(n, p.level), 0);
    return [
      {
        connectionId: c.id,
        other,
        photoUrl: other.photoPath ? (urls.get(other.photoPath) ?? null) : null,
        journey: j
          ? {
              id: j.id,
              path: j.path as PathCode,
              proposedByMe: j.proposed_by === me,
              accepted: !!j.accepted_at,
            }
          : null,
        mine: count(me),
        theirs: count(c.otherId),
      },
    ];
  });
}

export async function getCouple(me: string, connectionId: string) {
  return (await getCouples(me, connectionId))[0] ?? null;
}
