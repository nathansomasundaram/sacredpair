"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { checkVerification } from "@/lib/identity/actions";

/**
 * While an ID check is processing, asks every few seconds whether it has
 * finished. A verified result moves the member on by itself; any other
 * result reloads the page so it can explain what happened.
 */
export function ProcessingPoller({
  intervalMs = 4000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();
  const busy = useRef(false);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const { status } = await checkVerification();
        if (status !== "processing" && status !== "pending") router.refresh();
      } finally {
        busy.current = false;
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, router]);

  return null;
}
