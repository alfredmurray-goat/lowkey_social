import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { summarizeChatFn } from "@/lib/lowkey/ai.functions";

export function ChatTldrBar({
  conversationId,
  unreadCount,
}: {
  conversationId: string;
  unreadCount: number;
}) {
  const summarize = useServerFn(summarizeChatFn);
  const [busy, setBusy] = useState(false);
  const [bullets, setBullets] = useState<string[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!bullets && unreadCount < 20) return null;

  const run = async () => {
    setBusy(true);
    try {
      const res = await summarize({ data: { conversationId } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBullets(res.bullets);
    } catch {
      toast.error("couldn't summarize right now");
    } finally {
      setBusy(false);
    }
  };

  if (!bullets) {
    return (
      <div className="flex items-center justify-center px-3 pb-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="lowkey inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition active:scale-95 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          tldr ({unreadCount} unread)
        </button>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 rounded-2xl border border-border bg-primary-soft/60 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="lowkey inline-flex items-center gap-1 text-xs font-bold">
          <Sparkles className="size-3.5 text-primary" /> chat tldr
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="dismiss tldr"
          className="rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="lowkey list-disc space-y-1 pl-4 text-xs text-foreground">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  );
}