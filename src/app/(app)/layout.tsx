import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireVerifiedMember } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireVerifiedMember();
  return <AppShell>{children}</AppShell>;
}
