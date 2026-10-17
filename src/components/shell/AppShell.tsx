import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { TabNav } from "./TabNav";

/**
 * Frame for the signed-in app. Phones: brand header on top, tab bar fixed at
 * the bottom (clear of the home indicator). Tablet and up: a side rail.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-e border-line px-4 py-6 md:flex">
        <Link href="/discover" className="px-3">
          <Wordmark />
        </Link>
        <TabNav variant="rail" />
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-line bg-paper/95 px-4 backdrop-blur md:hidden">
        <Link href="/discover">
          <Wordmark size={24} />
        </Link>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-2xl px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:mx-0 md:px-10 md:pt-10 md:pb-10"
      >
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <TabNav variant="bar" />
      </div>
    </div>
  );
}
