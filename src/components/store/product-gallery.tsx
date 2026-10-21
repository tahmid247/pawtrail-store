"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { cn } from "@/components/ui/cn";

type Img = { id: string; url: string; alt: string };

export function ProductGallery({ images }: { images: Img[] }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, images.length]);

  if (!images.length) return <div className="aspect-square rounded-3xl bg-lavender-pale" />;
  const current = images[index];

  return (
    <div className="lg:sticky lg:top-28">
      <div className="relative overflow-hidden rounded-3xl bg-lavender-pale">
        <button
          type="button"
          className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          onClick={() => setLightbox(true)}
          aria-label={`Enlarge image: ${current.alt}`}
        >
          <Image
            src={current.url}
            alt={current.alt}
            fill
            priority={index === 0}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-transform duration-200 ease-out"
            style={zoom ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
          <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-soft backdrop-blur">
            <ZoomIn className="size-3.5" aria-hidden /> Zoom
          </span>
        </button>
        {images.length > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => setIndex((index - 1 + images.length) % images.length)} />
            <GalleryArrow side="right" onClick={() => setIndex((index + 1) % images.length)} />
          </>
        )}
      </div>
      {images.length > 1 && (
        <ul className="mt-4 grid grid-cols-5 gap-3" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}: ${img.alt}`}
                aria-current={i === index}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-xl bg-lavender-pale ring-2 ring-offset-2 transition",
                  i === index ? "ring-primary" : "ring-transparent hover:ring-line",
                )}
              >
                <Image src={img.url} alt="" fill sizes="120px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={() => setLightbox(false)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Close image viewer" autoFocus onClick={() => setLightbox(false)}>
            <X className="size-5" />
          </button>
          <div className="relative aspect-square w-full max-w-[min(90vh,900px)]" onClick={(e) => e.stopPropagation()}>
            <Image src={current.url} alt={current.alt} fill sizes="90vw" className="rounded-2xl object-contain" />
          </div>
          {images.length > 1 && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
              {index + 1} / {images.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GalleryArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn("absolute top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink shadow-soft backdrop-blur transition hover:bg-white", side === "left" ? "left-3" : "right-3")}
    >
      <Icon className="size-5" />
    </button>
  );
}
