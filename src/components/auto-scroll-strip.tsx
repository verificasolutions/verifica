"use client";

import { Children, type ReactNode, useEffect, useRef } from "react";

export function AutoScrollStrip({
  children,
  intervalMs = 30000,
  className = "",
}: {
  children: ReactNode;
  intervalMs?: number;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pageIndexRef = useRef(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const rotate = () => {
      const maxScrollLeft = Math.max(0, content.scrollWidth - viewport.clientWidth);
      if (maxScrollLeft <= 8) {
        pageIndexRef.current = 0;
        viewport.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }

      const currentLeft = viewport.scrollLeft;
      const step = viewport.clientWidth;

      if (currentLeft >= maxScrollLeft - 8) {
        pageIndexRef.current = 0;
        viewport.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }

      const nextLeft = Math.min(maxScrollLeft, currentLeft + step);
      pageIndexRef.current += 1;
      viewport.scrollTo({ left: nextLeft, behavior: "smooth" });
    };

    const intervalId = window.setInterval(rotate, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [intervalMs]);

  return (
    <div ref={viewportRef} className={`overflow-x-auto ${className}`}>
      <div ref={contentRef} className="flex w-max gap-4">
        {Children.toArray(children)}
      </div>
    </div>
  );
}
