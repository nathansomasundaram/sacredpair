import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getUnreadTotal } from "@/lib/chat/data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireVerifiedMember();
  // Unread messages for the Chat tab's badge; refreshed whenever the member
  // reads a conversation or the Chat list updates.
  const unread = await getUnreadTotal();
  return <AppShell unread={unread}>{children}</AppShell>;
}
