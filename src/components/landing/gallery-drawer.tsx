"use client";

import { useEffect, useState } from "react";
import { LandingImage } from "@/components/landing/landing-image";
import { LANDING_SECTION_GRADIENT } from "@/components/landing/visual-tokens";

type GalleryImage = {
  id: string;
  url: string;
  title?: string | null;
};

type Props = {
  images: GalleryImage[];
  triggerLabel?: string;
};

export function LandingGalleryDrawer({ images, triggerLabel = "Ver mais" }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-black/10 bg-black/5 px-5 text-sm font-semibold text-landing-text"
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Galeria completa">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className={`relative z-10 mx-auto my-4 max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,60rem)] overflow-y-auto rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-4 shadow-[0_24px_90px_rgba(0,0,0,0.5)]`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-landing-text">Galeria completa</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar galeria"
                className="flex min-h-11 items-center rounded-2xl border border-black/10 bg-black/5 px-4 text-sm text-landing-text"
              >
                Fechar (ESC)
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image) => (
                <LandingImage
                  key={image.id}
                  src={image.url}
                  alt={image.title ?? ""}
                  width={480}
                  height={480}
                  sizes="(min-width: 640px) 33vw, 50vw"
                  className="aspect-square w-full rounded-2xl border border-black/10 object-cover"
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
