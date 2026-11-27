import { Link } from "@tanstack/react-router";
import { X, Send, CornerDownRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CaptionText } from "@/components/lowkey/caption-text";
import { Avatar } from "@/components/lowkey/shell";
import { useLowkey } from "@/lib/lowkey/store";

function ago(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

/** one shared comment sheet for the feed and for videos */
export function CommentsSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { state, me, addComment } = useLowkey();
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const post = state.posts.find((p) => p.id === postId);

  const comments = state.comments
    .filter((c) => c.postId === postId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setDraft("");
    setReplyingTo(null);
    await addComment(postId, text);
    setSending(false);
  };

  const startReply = (handle: string) => {
    const clean = handle.toLowerCase();
    const prefix = `@${clean} `;
    setReplyingTo(clean);
    setDraft((prev) => {
      const trimmed = prev.trimStart();
      if (trimmed.toLowerCase().startsWith(prefix)) return prev;
      return `${prefix}${trimmed}`;
    });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 backdrop-blur-sm">
      <button aria-label="close comments" className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[75vh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="lowkey text-sm font-bold">
            comments {comments.length > 0 && <span className="text-muted-foreground">{comments.length}</span>}
          </p>
          <button
            onClick={onClose}
            aria-label="close"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-3">
          {comments.length === 0 && (
            <p className="lowkey py-8 text-center text-sm text-muted-foreground">
              no comments yet — go first
            </p>
          )}
          {comments.map((c) => {
            const author = state.profiles.find((p) => p.id === c.authorId);
            const isOp = Boolean(post && c.authorId === post.authorId);
            return (
              <div key={c.id} className="flex gap-3">
                <Avatar
                  hue={author?.avatarHue ?? 60}
                  label={author?.displayName ?? "someone"}
                  src={author?.avatarUrl ?? null}
                  size={30}
                />
                <div className="min-w-0 flex-1">
                  <p className="lowkey flex items-center gap-2 text-xs font-semibold">
                    {author ? (
                      <Link
                        {...(author.id === me?.id
                          ? { to: "/app/profile" as const }
                          : { to: "/app/u/$handle" as const, params: { handle: author.handle } })}
                      >
                        @{author.handle}
                      </Link>
                    ) : (
                      <span>someone</span>
                    )}
                    {isOp && (
                      <span className="lowkey rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-extrabold text-primary-foreground">
                        op
                      </span>
                    )}
                    <span className="font-normal text-muted-foreground">{ago(c.createdAt)}</span>
                  </p>
                  <p className="lowkey mt-0.5 text-sm break-words">
                    <CaptionText text={c.body} />
                  </p>
                  {author && (
                    <button
                      type="button"
                      onClick={() => startReply(author.handle)}
                      className="lowkey mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                    >
                      <CornerDownRight className="size-3" />
                      reply
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {replyingTo && (
          <div className="flex items-center justify-between border-t border-border bg-primary-soft/50 px-4 py-1.5 text-xs">
            <span className="lowkey font-semibold text-foreground">replying to @{replyingTo}</span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="cancel reply"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-center gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <Avatar hue={me?.avatarHue ?? 60} label={me?.displayName ?? "me"} src={me?.avatarUrl ?? null} size={30} />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            autoFocus
            placeholder={replyingTo ? `reply to @${replyingTo}` : "say something"}
            className="lowkey min-w-0 flex-1 rounded-full bg-muted px-4 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="send comment"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
