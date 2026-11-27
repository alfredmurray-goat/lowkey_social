import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { suggestCaptionsFn } from "@/lib/lowkey/ai.functions";

async function capturePreviewDataUrl(
  url: string,
  kind: "image" | "video",
): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    const maxDim = 512;
    if (kind === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("img load failed"));
        img.src = url;
      });
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.72);
    }
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((res, rej) => {
      video.onloadeddata = () => res();
      video.onerror = () => rej(new Error("video load failed"));
    });
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth || 1, video.videoHeight || 1));
    canvas.width = Math.max(1, Math.round((video.videoWidth || 320) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || 320) * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}

export function AiCaptionWand({
  mediaUrl,
  mediaKind,
  currentCaption,
  onPickCaption,
  onAddTag,
}: {
  mediaUrl: string | null;
  mediaKind: "image" | "video" | null;
  currentCaption: string;
  onPickCaption: (text: string) => void;
  onAddTag: (tag: string) => void;
}) {
  const suggest = useServerFn(suggestCaptionsFn);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ captions: string[]; tags: string[] } | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const imageDataUrl =
        mediaUrl && mediaKind ? await capturePreviewDataUrl(mediaUrl, mediaKind) : null;
      const res = await suggest({
        data: { imageDataUrl, hint: currentCaption.trim() || null },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult({ captions: res.captions, tags: res.tags });
    } catch {
      toast.error("could not get caption ideas right now");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="lowkey text-xs font-bold text-muted-foreground">caption &amp; #hashtags</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="lowkey inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-foreground transition hover:bg-primary/30 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          {result ? "reroll" : "magic wand"}
        </button>
      </div>

      {result && (
        <div className="rounded-2xl border border-border bg-muted/40 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="lowkey inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
              <Sparkles className="size-3 text-primary" /> tap to use
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run()}
              className="lowkey inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3" /> new ideas
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {result.captions.map((c, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onPickCaption(c)}
                className="lowkey rounded-xl border border-border bg-card px-3 py-2 text-left text-xs font-semibold hover:border-primary"
              >
                {c}
              </button>
            ))}
          </div>
          {result.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {result.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onAddTag(tag)}
                  className="lowkey rounded-full bg-primary/20 px-2.5 py-1 text-xs font-bold text-foreground hover:bg-primary/40"
                >
                  +#{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}