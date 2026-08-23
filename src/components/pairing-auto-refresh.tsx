"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PairingAutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      router.refresh();
    }, 20000);

    return () => window.clearTimeout(timer);
  }, [enabled, router]);

  return null;
}
