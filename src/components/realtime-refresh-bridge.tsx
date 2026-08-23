"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type RealtimeRefreshBridgeProps = {
  tenantId: string;
  scope: "tenant" | "operator";
};

export function RealtimeRefreshBridge({ tenantId, scope }: RealtimeRefreshBridgeProps) {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channelName = `vw-live:${scope}:${tenantId}`;
    const refresh = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      const now = Date.now();
      if (now - lastRefreshRef.current < 500) {
        return;
      }
      lastRefreshRef.current = now;
      router.refresh();
    };

    const channel = supabase.channel(channelName);
    const tables =
      scope === "tenant"
        ? ["attendances", "attendance_box_events", "attendance_media", "operation_boxes", "appointments", "cash_entries", "cash_sessions", "employees", "tenant_settings"]
        : ["attendances", "attendance_box_events", "attendance_media", "operation_boxes", "tenant_settings"];

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `tenant_id=eq.${tenantId}`,
        },
        refresh,
      );
    }

    channel.subscribe();
    const intervalId = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      supabase.removeChannel(channel);
    };
  }, [router, scope, tenantId]);

  useEffect(() => {
    const triggerProcessing = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void fetch("/api/jobs/process-messages", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => {
        // The queue will be retried on the next heartbeat.
      });
    };

    triggerProcessing();
    const intervalId = window.setInterval(triggerProcessing, 5000);
    window.addEventListener("focus", triggerProcessing);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", triggerProcessing);
    };
  }, []);

  return null;
}
