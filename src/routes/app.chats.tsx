import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronRight, MessageCircleHeart, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppScreen, Avatar, StreakPill } from "@/components/lowkey/shell";
import { useLowkey, useMyConversations } from "@/lib/lowkey/store";

export const Route = createFileRoute("/app/chats")({
  head: () => ({
    meta: [
      { title: "chats — lowkey_social" },
      {
        name: "description",
        content: "chat 1:1 or in groups with people your age and keep your daily streaks alive.",
      },
      { property: "og:title", content: "chats — lowkey_social" },
      { property: "og:description", content: "chat with friends and keep your streaks alive." },
    ],
  }),
  component: ChatsPage,
});

function ChatsPage() {
  const chats = useMyConversations();
  const [open, setOpen] = useState(false);

  return (
    <AppScreen>
      <div className="flex items-center justify-between gap-3 px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-13 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
            <MessageCircleHeart className="size-6" strokeWidth={2.4} />
          </span>
          <div>
            <h1 className="lowkey font-display text-2xl leading-tight font-bold">chats</h1>
            <p className="lowkey text-xs text-muted-foreground">dms &amp; group streaks</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="lowkey lk-btn-primary h-10 px-4 text-sm"
        >
          <Users className="size-4" /> new group
        </button>
      </div>
      <ul className="flex flex-col gap-2.5 px-4 pb-6">
        {chats.length === 0 && (
          <li className="lk-card flex flex-col items-center gap-3 p-8 text-center">
            <span className="lk-pill-icon h-12 w-15">
              <MessageCircleHeart className="size-6" strokeWidth={2.3} />
            </span>
            <p className="lowkey text-sm font-bold">no chats yet</p>
            <p className="lowkey text-xs text-muted-foreground">
              follow someone and say hi, or start a group chat.
            </p>
          </li>
        )}
        {chats.map(({ conversation, other, members, lastMessage, unread, streak }) => (
          <li key={conversation.id}>
            <Link
              to="/app/chat/$id"
              params={{ id: conversation.id }}
              className={`lk-card flex items-center gap-3 p-3.5 transition-all hover:bg-primary-soft/35 active:scale-[0.99] ${
                unread ? "border-primary/70" : ""
              }`}
            >
              {conversation.isGroup ? (
                <span className="lk-pill-icon size-11 shrink-0 text-lg">
                  {conversation.emoji || <Users className="size-5" />}
                </span>
              ) : (
                <Avatar
                  hue={other.avatarHue}
                  label={other.displayName}
                  src={other.avatarUrl}
                  size={44}
                  ring={unread}
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="lowkey truncate text-sm font-bold">
                    {conversation.isGroup
                      ? (conversation.title ?? "group")
                      : `@${other.handle}`}
                  </span>
                  {!conversation.isGroup && <StreakPill count={streak} />}
                </span>
                <span
                  className={`lowkey mt-0.5 block truncate text-xs ${
                    unread ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {lastMessage?.body ||
                    (lastMessage?.mediaUrl ? "sent a photo" : null) ||
                    (conversation.isGroup
                      ? members.map((m) => m.handle).join(", ")
                      : "say something")}
                </span>
              </span>
              {unread ? (
                <span className="lowkey rounded-xl bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-xs">
                  new
                </span>
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
              )}
            </Link>
          </li>
        ))}
      </ul>
      {open && <NewGroupSheet onClose={() => setOpen(false)} />}
    </AppScreen>
  );
}

function NewGroupSheet({ onClose }: { onClose: () => void }) {
  const { state, me, startGroup } = useLowkey();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const people = useMemo(() => {
    if (!me) return [];
    const following = new Set(
      state.follows.filter((f) => f.followerId === me.id).map((f) => f.followingId),
    );
    return state.profiles.filter(
      (p) => following.has(p.id) && p.ageBand === me.ageBand && !state.blocks.includes(p.id),
    );
  }, [state, me]);

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const create = async () => {
    setBusy(true);
    const id = await startGroup(title, picked);
    setBusy(false);
    if (id) void navigate({ to: "/app/chat/$id", params: { id } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 rounded-t-3xl bg-background p-5 shadow-xl animate-fade-in sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
              <Users className="size-5" strokeWidth={2.3} />
            </span>
            <h2 className="lowkey font-display text-lg font-bold">new group</h2>
          </div>
          <button onClick={onClose} aria-label="close" className="lk-pill-icon h-9 w-10">
            <X className="size-5" />
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="group name"
          className="lowkey rounded-2xl border border-input bg-card px-4 py-3 text-base outline-none"
        />
        <p className="lowkey text-xs text-muted-foreground">
          pick at least 2 people you follow ({picked.length} picked)
        </p>
        <ul className="-mx-2 flex-1 overflow-y-auto">
          {people.length === 0 && (
            <li className="lowkey p-6 text-center text-sm text-muted-foreground">
              follow some people first
            </li>
          )}
          {people.map((p) => {
            const on = picked.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => toggle(p.id)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-muted"
                >
                  <Avatar hue={p.avatarHue} label={p.displayName} src={p.avatarUrl} size={36} />
                  <span className="lowkey flex-1 truncate text-sm font-semibold">@{p.handle}</span>
                  <span
                    className={`flex size-6 items-center justify-center rounded-xl border-2 transition-colors ${
                      on ? "border-primary bg-primary text-primary-foreground shadow-xs" : "border-input"
                    }`}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          disabled={busy || picked.length < 2 || !title.trim()}
          onClick={() => void create()}
          className="lowkey lk-btn-primary min-h-12 text-sm disabled:opacity-50"
        >
          {busy ? "making it..." : "start group"}
        </button>
      </div>
    </div>
  );
}
