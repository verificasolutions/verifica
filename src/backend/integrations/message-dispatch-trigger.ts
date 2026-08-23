import "server-only";
import { getAppUrl } from "@/backend/shared/app-url";

export async function triggerMessageDispatchProcessing() {
  const appUrl = getAppUrl();
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!appUrl || !cronSecret) {
    return;
  }

  try {
    await fetch(`${appUrl}/api/jobs/process-messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(1200),
    });
  } catch {
    // The queue will still be processed by cron fallback.
  }
}
