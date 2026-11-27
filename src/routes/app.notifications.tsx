import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Heart, MessageCircle, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { AppScreen, Avatar } from "@/components/lowkey/shell";
import { useLowkey } from "@/lib/lowkey/store";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({
    meta: [
      { title: "notifications — lowkey_social" },
      {
        name: "description",
        content:
          "see who followed you, liked your posts or commented, and follow people back in one tap.",
      },
      { property: "og:title", content: "notifications — lowkey_social" },
      { property: "og:description", content: "follows, likes and comments on your stuff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function ago(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function bucket(iso: string): "today" | "this week" | "earlier" {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 24 * 60 * 60 * 1000) return "today";
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return "this week";
  return "earlier";
}

function NotificationsPage() {
  const { state, me, toggleFollow, markNotificationsRead } = useLowkey();

  useEffect(() => {
    if (state.notifications.some((n) => !n.readAt)) void markNotificationsRead();
  }, [state.notifications, markNotificationsRead]);

  const items = state.notifications.filter((n) => n.recipientId === me?.id);

  const groups = (["today", "this week", "earlier"] as const)
    .map((label) => ({
      label,
      rows: items.filter((n) => bucket(n.createdAt) === label),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <AppScreen title="notifications">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="lowkey font-display text-2xl font-bold">notifications</h1>
        {items.length > 0 && (
          <span className="lowkey rounded-full bg-primary-soft px-3 py-1 text-xs font-bold">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-3xl bg-primary-soft text-foreground">
            <Bell className="size-6" strokeWidth={2.2} />
          </span>
          <p className="lowkey font-display text-base font-bold">all quiet for now</p>
          <p className="lowkey text-xs text-muted-foreground">
            post something and see who shows up.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-4 py-3">
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-2">
              <h2 className="lowkey px-1 text-xs font-bold text-muted-foreground">{group.label}</h2>
              <ul className="flex flex-col gap-2">
                {group.rows.map((n) => {
                  const actor = state.profiles.find((p) => p.id === n.actorId);
                  if (!actor) return null;
                  const followsBack = state.follows.some(
                    (f) => f.followerId === me?.id && f.followingId === actor.id,
                  );
                  const text =
                    n.kind === "follow"
                      ? "followed you"
                      : n.kind === "like"
                        ? "liked your post"
                        : "commented on your post";
                  const BadgeIcon =
                    n.kind === "follow" ? UserPlus : n.kind === "like" ? Heart : MessageCircle;
                  return (
                    <li
                      key={n.id}
                      className={`flex items-center gap-3 rounded-3xl border px-3.5 py-3 shadow-xs ${
                        n.readAt
                          ? "border-border bg-card"
                          : "border-primary/40 bg-primary-soft/50"
                      }`}
                    >
                      <Link to="/app/u/$handle" params={{ handle: actor.handle }} className="relative shrink-0">
                        <Avatar
                          hue={actor.avatarHue}
                          label={actor.displayName}
                          src={actor.avatarUrl}
                          size={44}
                        />
                        <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
                          <BadgeIcon className="size-3" strokeWidth={2.5} />
                        </span>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="lowkey text-sm leading-snug">
                          <Link
                            to="/app/u/$handle"
                            params={{ handle: actor.handle }}
                            className="font-bold"
                          >
                            @{actor.handle}
                          </Link>{" "}
                          {text}
                        </p>
                        <p className="lowkey mt-0.5 text-xs text-muted-foreground">{ago(n.createdAt)} ago</p>
                      </div>
                      {n.kind === "follow" && (
                        <button
                          onClick={() => void toggleFollow(actor.id)}
                          className={`lowkey shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-transform active:scale-95 ${
                            followsBack
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary text-primary-foreground shadow-xs"
                          }`}
                        >
                          {followsBack ? "following" : "follow back"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppScreen>
  );
}
