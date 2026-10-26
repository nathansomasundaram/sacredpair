import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** Records a staff action in the activity log. */
export async function log(entry: {
  staff: string;
  action: string;
  target?: string | null;
  report?: string | null;
  story?: string | null;
  note?: string;
}) {
  const { error } = await createAdminClient()
    .from("moderation_actions")
    .insert({
      staff_id: entry.staff,
      action: entry.action,
      target_user: entry.target ?? null,
      report_id: entry.report ?? null,
      story_id: entry.story ?? null,
      note: entry.note ?? "",
    });
  if (error) throw error;
}
