import type { ReactNode } from "react";
import { PublicFooter } from "@/components/site/PublicFooter";
import { PublicHeader } from "@/components/site/PublicHeader";
import { getSessionUser } from "@/lib/auth/session";

/** The public website: home, tips, stories, FAQ and policies. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader signedIn={!!user} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
