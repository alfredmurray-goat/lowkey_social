import { cn } from "@/lib/utils";
import loaderAsset from "@/assets/lowkey-loader.webp.asset.json";

/**
 * User's hand-drawn scribble loading animation with background removed.
 */
export function ScribbleLoader({
  size = 64,
  label,
  fullScreen = false,
  className,
}: {
  size?: number;
  label?: string;
  fullScreen?: boolean;
  className?: string;
}) {
  const content = (
    <div
      role="status"
      aria-live="polite"
      className={cn("inline-flex flex-col items-center justify-center gap-3", className)}
    >
      <img
        src={loaderAsset.url}
        alt=""
        width={size}
        height={size}
        aria-hidden="true"
        className="object-contain select-none"
        style={{ width: size, height: size }}
      />
      {label && <span className="lowkey text-xs font-semibold text-muted-foreground">{label}</span>}
      <span className="sr-only">{label ?? "loading"}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex min-h-[60dvh] w-full items-center justify-center bg-background">
        {content}
      </div>
    );
  }
  return content;
}