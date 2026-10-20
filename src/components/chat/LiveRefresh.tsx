"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the Chat list current: refreshes when a message arrives in any of
 * the member's conversations (Realtime only delivers their own), or every
 * 15 seconds if live updates aren't available.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let live = false;
    const refresh = () => router.refresh();
    const channel = supabase
      .channel("chat-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "connections" },
        refresh,
      );
    (async () => {
      try {
        await supabase.realtime.setAuth();
      } catch {
        // fall back to the timer
      }
      channel.subscribe((status) => {
        live = status === "SUBSCRIBED";
      });
    })();
    const timer = window.setInterval(() => {
      if (!live && document.visibilityState === "visible") refresh();
    }, 15_000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
