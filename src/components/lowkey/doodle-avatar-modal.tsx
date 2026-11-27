import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { generateDoodleAvatarFn } from "@/lib/lowkey/ai.functions";

async function fileToResizedDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("could not read image"));
      img.src = url;
    });
    const maxDim = 512;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

export function DoodleAvatarModal({
  onClose,
  onSaveAvatar,
}: {
  onClose: () => void;
  onSaveAvatar: (file: File) => Promise<void>;
}) {
  const generateDoodle = useServerFn(generateDoodleAvatarFn);
  const inputRef = useRef<HTMLInputElement>(null);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setOptions([]);
    setPicked(null);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      const res = await generateDoodle({ data: { imageDataUrl: dataUrl } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOptions(res.options);
    } catch {
      toast.error("could not draw your doodle right now");
    } finally {
      setBusy(false);
    }
  };

  const confirmPick = async () => {
    const chosen = picked !== null ? options[picked] : null;
    if (!chosen) return;
    setSaving(true);
    try {
      const file = await dataUrlToFile(chosen, "doodle-avatar.png");
      await onSaveAvatar(file);
      onClose();
    } catch {
      toast.error("could not save doodle avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/50 p-3 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="lowkey text-base font-bold">make a doodle of me</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="close" className="lk-pill-icon size-8">
            <X className="size-4" />
          </button>
        </div>

        <p className="lowkey text-xs text-muted-foreground">
          your photo is sent to our ai service to draw your doodle and is never saved or stored.
          only the doodle you pick becomes your profile picture.
        </p>

        {!consented ? (
          <button
            type="button"
            onClick={() => setConsented(true)}
            className="lk-btn-primary lowkey w-full py-2.5 text-sm"
          >
            sounds good, let&apos;s go
          </button>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />

            {options.length === 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="lk-btn-primary lowkey flex w-full items-center justify-center gap-2 py-3 text-sm disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> drawing 2 doodles...
                  </>
                ) : (
                  <>
                    <Camera className="size-4" /> take selfie or pick photo
                  </>
                )}
              </button>
            )}

            {options.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {options.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPicked(i)}
                      className={`relative overflow-hidden rounded-2xl border-2 transition ${
                        picked === i ? "border-primary ring-2 ring-primary/40" : "border-border"
                      }`}
                    >
                      <img src={src} alt={`doodle option ${i + 1}`} className="aspect-square w-full object-cover" />
                      {picked === i && (
                        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || saving}
                    onClick={() => inputRef.current?.click()}
                    className="lk-btn-soft lowkey flex-1 py-2.5 text-xs"
                  >
                    try another
                  </button>
                  <button
                    type="button"
                    disabled={picked === null || saving}
                    onClick={() => void confirmPick()}
                    className="lk-btn-primary lowkey flex-1 py-2.5 text-xs disabled:opacity-50"
                  >
                    {saving ? "saving..." : "use this doodle"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}