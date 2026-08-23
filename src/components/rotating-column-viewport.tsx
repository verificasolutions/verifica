"use client";

import { Children, type ReactNode, useEffect, useMemo, useState } from "react";

export function RotatingColumnViewport({
  children,
  itemsPerPage = 5,
  intervalMs = 30000,
  className = "",
}: {
  children: ReactNode;
  itemsPerPage?: number;
  intervalMs?: number;
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

  useEffect(() => {
    if (pages.length <= 1) {
      setPageIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setPageIndex((current) => (current + 1) % pages.length);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs, pages.length]);

  if (pages.length <= 1) {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <div className="grid min-w-[1500px] gap-4 xl:grid-cols-5">{items}</div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${pageIndex * 100}%)` }}
      >
        {pages.map((page, index) => (
          <div key={index} className="min-w-full">
            <div className="grid min-w-[1500px] gap-4 xl:grid-cols-5">{page}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
