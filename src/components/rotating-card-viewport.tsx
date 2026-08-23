"use client";

import { Children, type ReactNode, useEffect, useMemo, useState } from "react";

export function RotatingCardViewport({
  children,
  itemsPerPage = 2,
  intervalMs = 30000,
  initialDelayMs = intervalMs,
  className = "",
}: {
  children: ReactNode;
  itemsPerPage?: number;
  intervalMs?: number;
  initialDelayMs?: number;
  className?: string;
}) {
  const items = Children.toArray(children);
  const pages = useMemo(() => {
    const nextPages: ReactNode[][] = [];

    for (let index = 0; index < items.length; index += itemsPerPage) {
      nextPages.push(items.slice(index, index + itemsPerPage));
    }

    return nextPages;
  }, [items, itemsPerPage]);

  const [pageIndex, setPageIndex] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (pages.length <= 1) {
      setPageIndex(0);
      return;
    }

    let intervalId: number | null = null;
    let leaveTimeoutId: number | null = null;

    const rotatePage = () => {
      setIsLeaving(true);

      leaveTimeoutId = window.setTimeout(() => {
        setPageIndex((current) => (current + 1) % pages.length);
        setIsLeaving(false);
      }, 260);
    };

    const startTimeoutId = window.setTimeout(() => {
      rotatePage();
      intervalId = window.setInterval(rotatePage, intervalMs);
    }, Math.max(0, initialDelayMs));

    return () => {
      window.clearTimeout(startTimeoutId);
      if (intervalId !== null) window.clearInterval(intervalId);
      if (leaveTimeoutId !== null) window.clearTimeout(leaveTimeoutId);
    };
  }, [initialDelayMs, intervalMs, pages.length]);

  const currentPage = pages[pageIndex] ?? [];

  return (
    <div className={className}>
      <div className={`grid gap-3 transition-all duration-300 ${isLeaving ? "-translate-y-4 opacity-0" : "translate-y-0 opacity-100"}`}>
        {currentPage}
      </div>
    </div>
  );
}
