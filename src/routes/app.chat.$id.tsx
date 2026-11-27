import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ImagePlus, LogOut, Send, Settings2, Trash2, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AppScreen, Avatar, StreakPill } from "@/components/lowkey/shell";
import { useLowkey } from "@/lib/lowkey/store";

export const Route = createFileRoute("/app/chat/$id")({
  head: () => ({
    meta: [
      { title: "chat — lowkey_social" },
      { name: "description", content: "a lowkey chat thread with a friend in your age band." },
      { property: "og:title", content: "chat — lowkey_social" },
      { property: "og:description", content: "a lowkey chat thread with a friend." },
    ],
  }),
  component: ThreadPage,
});

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase();
}

function ThreadPage() {
  const { id } = Route.useParams();
  const { state, me, sendMessage, sendPhoto, deleteMessage, markRead } = useLowkey();
  const [groupOpen, setGroupOpen] = useState(false);
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      toast.error("photos only");
      return;
    }
    if (file.size > 20_000_000) {
      toast.error("keep it under 20mb");
      return;
    }
    await sendPhoto(id, file);
  };

  const conversation = state.conversations.find((c) => c.id === id);
  const allowed = !!conversation && !!me && conversation.memberIds.includes(me.id);

  useEffect(() => {
    if (me && !allowed) void navigate({ to: "/app/chats", replace: true });
  }, [me, allowed, navigate]);

  useEffect(() => {
    if (allowed) markRead(id);
  }, [allowed, id, markRead]);

  const messages = state.messages
    .filter((m) => m.conversationId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, id]);

  if (!allowed || !conversation || !me) {
    return <AppScreen chrome={false}>{null}</AppScreen>;
  }

  const otherId = conversation.memberIds.find((m) => m !== me.id) ?? me.id;
  const other = state.profiles.find((p) => p.id === otherId) ?? me;
  const isGroup = conversation.isGroup;
  const byId = (pid: string) => state.profiles.find((p) => p.id === pid);
  const streak = state.streaks.find((s) => s.conversationId === id)?.count ?? 0;

  return (
    <AppScreen chrome={false}>
      <div className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden bg-background">
        <header className="shrink-0 px-3 pt-3 pb-2">
          <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-3xl border border-border bg-card px-3 py-2.5 shadow-xs">
            <Link
              to="/app/chats"
              aria-label="back"
              className="flex size-10 items-center justify-center rounded-2xl text-muted-foreground transition-transform hover:bg-muted active:scale-90"
            >
              <ArrowLeft className="size-5" strokeWidth={2.2} />
            </Link>
            {isGroup ? (
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-lg">
                {conversation.emoji ?? <Users className="size-5" />}
              </span>
            ) : (
              <Avatar hue={other.avatarHue} label={other.displayName} size={40} src={other.avatarUrl} />
            )}
            <div className="min-w-0 flex-1">
              <p className="lowkey truncate font-display text-base font-bold">
                {isGroup ? conversation.title ?? "group" : `@${other.handle}`}
              </p>
              {isGroup ? (
                <p className="lowkey text-xs text-muted-foreground">
                  {conversation.memberIds.length} people
                </p>
              ) : (
                <StreakPill count={streak} />
              )}
            </div>
            {isGroup ? (
              <button
                type="button"
                onClick={() => setGroupOpen(true)}
                aria-label="group settings"
                className="flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-foreground transition-transform active:scale-90"
              >
                <Settings2 className="size-5" strokeWidth={2.2} />
              </button>
            ) : (
              <span />
            )}
          </div>
        </header>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {messages.length === 0 ? (
            <p className="lowkey py-16 text-center text-sm text-muted-foreground">
              say hi — your messages show up here.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {messages.map((m, idx) => {
                const mine = m.authorId === me.id;
                const label = dayLabel(m.createdAt);
                const prevLabel = idx > 0 ? dayLabel(messages[idx - 1]!.createdAt) : null;
                const showDay = label !== prevLabel;
                return (
                  <div key={m.id} className="flex flex-col gap-2">
                    {showDay && (
                      <div className="my-2 flex justify-center">
                        <span className="lowkey rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-muted-foreground">
                          {label}
                        </span>
                      </div>
                    )}
                    <div className={`lowkey max-w-[78%] ${mine ? "self-end" : "self-start"}`}>
                      {isGroup && !mine && (
                        <p className="mb-1 px-2 text-[11px] font-bold text-muted-foreground">
                          @{byId(m.authorId)?.handle ?? "someone"}
                        </p>
                      )}
                      <div
                        className={`group relative flex flex-col gap-1.5 rounded-3xl px-4 py-2.5 text-sm shadow-xs ${
                          mine
                            ? "rounded-br-md bg-primary font-medium text-primary-foreground"
                            : "rounded-bl-md border border-border bg-card text-foreground"
                        }`}
                      >
                        {m.mediaUrl && (
                          <img
                            src={m.mediaUrl}
                            alt="photo in chat"
                            className="max-h-72 w-full max-w-56 rounded-2xl object-cover"
                          />
                        )}
                        {m.body && <p className="break-words">{m.body}</p>}
                        {mine && (
                          <button
                            type="button"
                            onClick={() => void deleteMessage(m.id)}
                            aria-label="delete message"
                            className="absolute -top-2.5 -right-2.5 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            sendMessage(id, draft);
            setDraft("");
          }}
          className="shrink-0 border-t border-border bg-card/95 px-3 py-2.5 backdrop-blur"
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-border bg-background p-1.5">
            <button
              type="button"
              aria-label="send a photo"
              onClick={() => fileRef.current?.click()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-foreground transition-transform active:scale-90"
            >
              <ImagePlus className="size-5" strokeWidth={2.2} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => void onPhoto(e.target.files?.[0])}
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder="say something..."
              className="lowkey min-w-0 bg-transparent px-2 py-2 text-base outline-none"
            />
            <button
              type="submit"
              aria-label="send"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform active:scale-90"
            >
              <Send className="size-4" strokeWidth={2.4} />
            </button>
          </div>
        </form>
      </div>

      {isGroup && groupOpen && <GroupSheet conversationId={id} onClose={() => setGroupOpen(false)} />}
    </AppScreen>
  );
}

const EMOJIS = ["🌻", "🎮", "⚽", "🎨", "🎧", "📚", "🍕", "✨", "🛹", "🌙"];

function GroupSheet({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const { state, me, addGroupMembers, updateGroup, removeGroupMember, convertGroupToCommunity } = useLowkey();
  const navigate = useNavigate();
  const conversation = state.conversations.find((c) => c.id === conversationId);
  const [title, setTitle] = useState(conversation?.title ?? "");
  const [emoji, setEmoji] = useState<string | null>(conversation?.emoji ?? null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!conversation || !me) return null;
  const isOwner = conversation.createdBy === me.id;
  const members = conversation.memberIds.map((pid) => state.profiles.find((p) => p.id === pid)).filter((p): p is NonNullable<typeof p> => !!p);
  const candidates = state.follows
    .filter((f) => f.followerId === me.id)
    .map((f) => state.profiles.find((p) => p.id === f.followingId))
    .filter((p): p is NonNullable<typeof p> => !!p && p.ageBand === conversation.ageBand && !conversation.memberIds.includes(p.id));
  const run = async (fn: () => Promise<boolean>, ok: string) => { setBusy(true); const done = await fn(); setBusy(false); if (done) toast.success(ok); return done; };

  const sheet = (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/40 backdrop-blur-xs" onClick={onClose}>
      <div
        role="dialog"
        aria-label="group settings"
        onClick={(e) => e.stopPropagation()}
        className="lowkey max-h-[85dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border bg-card p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">group settings</h2>
          <button type="button" onClick={onClose} aria-label="close" className="flex size-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <section className="space-y-3 rounded-3xl border border-border bg-background p-4">
          <p className="text-xs font-bold text-muted-foreground">name + vibe</p>
          <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-base outline-none" />
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button type="button" key={e} onClick={() => setEmoji(emoji === e ? null : e)} className={`flex size-11 items-center justify-center rounded-2xl text-lg transition-transform active:scale-90 ${emoji === e ? "bg-primary" : "bg-muted"}`}>{e}</button>
            ))}
          </div>
          <button type="button" disabled={busy || !title.trim()} onClick={() => void run(() => updateGroup(conversationId, title, emoji), "group updated")} className="lk-btn-primary h-11 w-full disabled:opacity-50">save</button>
        </section>

        <section className="mt-4 rounded-3xl border border-border bg-background p-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">{members.length} people</p>
          {members.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
              <Avatar hue={p.avatarHue} label={p.displayName} size={36} src={p.avatarUrl} />
              <Link to="/app/u/$handle" params={{ handle: p.handle }} className="min-w-0 flex-1 truncate text-sm font-semibold">@{p.handle}{p.id === conversation.createdBy && <span className="ml-2 text-xs text-muted-foreground">creator</span>}</Link>
              {isOwner && p.id !== me.id && (
                <button type="button" aria-label={`remove @${p.handle}`} disabled={busy} onClick={() => void run(() => removeGroupMember(conversationId, p.id), "removed")} className="flex size-10 items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted"><UserMinus className="size-4" /></button>
              )}
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-3xl border border-border bg-background p-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">add people you follow</p>
          {candidates.length === 0 ? <p className="text-sm text-muted-foreground">no one else to add rn</p> : (
            <>
              <div className="flex flex-wrap gap-2">
                {candidates.map((p) => {
                  const on = picked.includes(p.id);
                  return <button type="button" key={p.id} onClick={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])} className={`flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{on && <Check className="size-4" />}@{p.handle}</button>;
                })}
              </div>
              <button type="button" disabled={busy || !picked.length} onClick={() => void run(() => addGroupMembers(conversationId, picked), "added to the group").then((ok) => ok && setPicked([]))} className="lk-btn-soft mt-3 flex h-11 w-full items-center justify-center gap-2 disabled:opacity-50"><UserPlus className="size-4" />add {picked.length || ""}</button>
            </>
          )}
        </section>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const cid = await convertGroupToCommunity(conversationId, title, emoji ?? undefined);
            setBusy(false);
            if (cid) {
              toast.success("group is now a community!");
              void navigate({ to: "/app/community/$id", params: { id: cid } });
            }
          }}
          className="lk-btn-primary mt-5 flex h-12 w-full items-center justify-center gap-2 disabled:opacity-50"
        >
          🏫 turn into a community
        </button>

        <button type="button" disabled={busy} onClick={() => void run(() => removeGroupMember(conversationId, me.id), "you left the group").then((ok) => { if (ok) void navigate({ to: "/app/chats" }); })} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-destructive text-destructive font-semibold"><LogOut className="size-4" />leave group</button>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(sheet, document.body) : sheet;
}
