import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PhotoCarousel({ urls, caption, onOpen, initialIndex = 0, fullscreen = false }: {
  urls: string[];
  caption: string;
  onOpen?: (index: number) => void;
  initialIndex?: number;
  fullscreen?: boolean;
}) {
  const [ref, api] = useEmblaCarousel({ startIndex: initialIndex, loop: false });
  const [index, setIndex] = useState(initialIndex);
  useEffect(() => {
    if (!api) return;
    const select = () => setIndex(api.selectedScrollSnap());
    select();
    api.on("select", select);
    api.on("reInit", select);
    return () => { api.off("select", select); api.off("reInit", select); };
  }, [api]);
  return (
    <section
      aria-label="post photos"
      aria-roledescription="carousel"
      className={cn("relative min-w-0", fullscreen && "flex h-full min-h-0 flex-col")}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); api?.scrollNext(); }
        if (event.key === "ArrowLeft") { event.preventDefault(); api?.scrollPrev(); }
      }}
    >
      <div ref={ref} className={cn("overflow-hidden rounded-2xl touch-pan-y", fullscreen && "min-h-0 flex-1 rounded-none")}>
        <div className={cn("flex", fullscreen && "h-full")}>
          {urls.map((url, i) => (
            <div key={`${url}-${i}`} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${urls.length}`} className="min-w-0 flex-[0_0_100%]">
              {onOpen ? (
                <Button variant="ghost" onClick={() => onOpen(i)} aria-label={`open photo ${i + 1} full screen`} className="group relative block h-auto w-full overflow-hidden rounded-none p-0">
                  <img src={url} alt={`${caption || "post photo"} (${i + 1} of ${urls.length})`} loading="lazy" draggable={false} className="aspect-square w-full object-cover" />
                  <Maximize2 className="absolute right-3 bottom-3 size-5 rounded bg-background/85 text-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                </Button>
              ) : (
                <img src={url} alt={`${caption || "post photo"} (${i + 1} of ${urls.length})`} loading="lazy" draggable={false} className={fullscreen ? "h-full w-full object-contain" : "aspect-square w-full object-cover"} />
              )}
            </div>
          ))}
        </div>
      </div>
      {urls.length > 1 && <>
        <span aria-live="polite" aria-atomic="true" className="pointer-events-none absolute top-3 right-3 rounded-full bg-card/90 px-3 py-1 text-xs font-bold text-card-foreground">{index + 1} / {urls.length}</span>
        <div className="flex shrink-0 items-center justify-center gap-2 py-2">
          <Button size="icon" variant="secondary" className="size-9 rounded-full" aria-label="previous photo" disabled={index === 0} onClick={() => api?.scrollPrev()}><ChevronLeft className="size-4" /></Button>
          <div className="flex flex-wrap justify-center gap-0.5">
            {urls.map((_, i) => <Button key={i} variant="ghost" size="icon" aria-label={`show photo ${i + 1}`} aria-current={index === i ? "true" : undefined} onClick={() => api?.scrollTo(i)} className="size-7 rounded-full p-0"><span className={cn("size-2 rounded-full", index === i ? "bg-primary" : "bg-muted-foreground/40")} /></Button>)}
          </div>
          <Button size="icon" variant="secondary" className="size-9 rounded-full" aria-label="next photo" disabled={index === urls.length - 1} onClick={() => api?.scrollNext()}><ChevronRight className="size-4" /></Button>
        </div>
      </>}
    </section>
  );
}