"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FlashNoticeProps = {
  error?: string;
  message?: string;
  variant?: "inline" | "overlay";
};

export function FlashNotice({ error, message, variant = "inline" }: FlashNoticeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!error && !message) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("error");
    nextParams.delete("message");

    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [error, message, pathname, router, searchParams]);

  if (!visible || (!error && !message)) {
    return null;
  }

  const baseClassName =
    variant === "overlay"
      ? "pointer-events-none fixed inset-x-0 top-1/2 z-[90] flex -translate-y-1/2 justify-center px-4"
      : "";

  const cardClassName =
    variant === "overlay"
      ? "w-full max-w-[520px] rounded-[24px] px-5 py-4 text-center text-sm shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl"
      : "rounded-2xl px-4 py-3 text-sm";

  if (error) {
    return (
      <div className={baseClassName}>
        <div className={`${cardClassName} border border-rose-300/20 bg-rose-300/14 text-rose-100`}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={baseClassName}>
      <div className={`${cardClassName} border border-emerald-300/20 bg-emerald-300/14 text-emerald-100`}>
        {message}
      </div>
    </div>
  );
}
