import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Clapperboard, X } from "lucide-react";
import { useState } from "react";
import { AppScreen, Avatar, Poster } from "@/components/lowkey/shell";
import { CaptionText } from "@/components/lowkey/caption-text";
import { useLowkey } from "@/lib/lowkey/store";
import type { Post } from "@/lib/lowkey/types";

export const Route = createFileRoute("/app/saved")({
  head: () => ({
    meta: [
      { title: "saved — lowkey_social" },
      {
        name: "description",
        content: "everything you bookmarked on lowkey_social, kept in one place just for you.",
      },
      { property: "og:title", content: "saved — lowkey_social" },
      { property: "og:description", content: "the posts and videos you bookmarked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { state, toggleBookmark } = useLowkey();
  const [tab, setTab] = useState<"all" | "post" | "video">("all");
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const saved = state.posts.filter((p) => state.bookmarks.includes(p.id));
  const filtered = saved.filter((p) => (tab === "all" ? true : p.kind === tab));

  return (
    <AppScreen title="saved">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="lowkey font-display text-2xl font-bold">saved</h1>
          <span className="lowkey rounded-full bg-primary-soft px-3 py-1 text-xs font-bold">
            {saved.length} {saved.length === 1 ? "item" : "items"}
          </span>
        </div>
        <div className="mt-3 flex gap-1.5 rounded-full bg-muted p-1">
          {(
            [
              ["all", "all"],
              ["post", "posts"],
              ["video", "videos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`lowkey flex-1 rounded-full py-2 text-xs font-bold transition-all ${
                tab === id ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-3xl bg-primary-soft text-foreground">
            <Bookmark className="size-6" strokeWidth={2.2} />
          </span>
          <p className="lowkey font-display text-base font-bold">nothing saved here yet</p>
          <p className="lowkey text-xs text-muted-foreground">
            tap the bookmark on any post or video to keep it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 py-3">
          {filtered.map((p) => {
            const author = state.profiles.find((a) => a.id === p.authorId);
            return (
              <div
                key={p.id}
                className="relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenPost(p)}
                  className="relative aspect-[4/5] w-full overflow-hidden text-left"
                >
                  <Poster hue={p.posterHue} caption={p.mediaUrl ? "" : p.caption} mediaUrl={p.mediaUrl} />
                  {p.kind === "video" && (
                    <span className="absolute top-2.5 left-2.5 flex size-7 items-center justify-center rounded-xl bg-foreground/75 text-background">
                      <Clapperboard className="size-3.5" />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleBookmark(p.id)}
                  aria-label="remove bookmark"
                  className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-2xl bg-card/90 text-primary shadow-xs backdrop-blur"
                >
                  <Bookmark className="size-4 fill-primary" />
                </button>
                <div className="flex flex-col gap-1 p-3">
                  {author && (
                    <Link
                      to="/app/u/$handle"
                      params={{ handle: author.handle }}
                      className="flex items-center gap-1.5"
                    >
                      <Avatar hue={author.avatarHue} label={author.displayName} src={author.avatarUrl} size={20} />
                      <span className="lowkey truncate text-xs font-bold">@{author.handle}</span>
                    </Link>
                  )}
                  {p.caption && (
                    <p className="lowkey line-clamp-2 text-xs text-muted-foreground">{p.caption}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openPost && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-xs"
          onClick={() => setOpenPost(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="lowkey text-xs font-bold text-muted-foreground">saved {openPost.kind}</span>
              <button type="button" onClick={() => setOpenPost(null)} aria-label="close" className="flex size-8 items-center justify-center rounded-2xl bg-muted">
                <X className="size-4" />
              </button>
            </div>
            {openPost.kind === "video" && openPost.mediaUrl ? (
              <video src={openPost.mediaUrl} controls playsInline className="max-h-96 w-full rounded-2xl bg-muted object-cover" />
            ) : (
              <Poster hue={openPost.posterHue} caption={openPost.mediaUrl ? "" : openPost.caption} mediaUrl={openPost.mediaUrl} />
            )}
            {openPost.caption && (
              <p className="lowkey mt-3 text-sm">
                <CaptionText text={openPost.caption} chips />
              </p>
            )}
          </div>
        </div>
      )}
    </AppScreen>
  );
}
