import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Hash } from "lucide-react";
import { AppScreen, Avatar } from "@/components/lowkey/shell";
import { useBandPosts, useBandProfiles, useLowkey } from "@/lib/lowkey/store";

export const Route = createFileRoute("/app/search")({
  head: () => ({
    meta: [
      { title: "search — lowkey_social" },
      {
        name: "description",
        content: "search people and posts inside your own age band on lowkey_social.",
      },
      { property: "og:title", content: "search — lowkey_social" },
      { property: "og:description", content: "search people and posts in your age band." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "tags">("all");
  const profiles = useBandProfiles();
  const posts = useBandPosts();
  const { me, toggleFollow, state } = useLowkey();
  const term = q.trim().toLowerCase().replace(/^#/, "");

  // Trending hashtags in your age band
  const tagCounts = new Map<string, number>();
  for (const h of state.hashtags) {
    if (me?.ageBand && h.ageBand === me.ageBand) {
      tagCounts.set(h.tag, (tagCounts.get(h.tag) ?? 0) + 1);
    }
  }
  const trendingTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([t]) => !term || t.includes(term))
    .slice(0, 16);

  const people = term
    ? profiles.filter(
        (p) => p.id !== me?.id && (p.handle.includes(term) || p.displayName.includes(term)),
      )
    : profiles.filter((p) => p.id !== me?.id);
  const hits = term ? posts.filter((p) => p.caption.includes(term)) : [];

  return (
    <AppScreen title="search">
      <div className="px-4 py-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search people, posts or #tags"
          className="lowkey w-full rounded-full border border-border bg-card px-4 py-3 text-sm outline-none"
        />

        <div className="mt-3 flex gap-1 rounded-full bg-muted p-1">
          {(
            [
              ["all", "people & posts"],
              ["tags", "#tags"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`lowkey flex-1 rounded-full py-2 text-xs font-bold ${
                tab === k ? "bg-background shadow-xs" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {trendingTags.length > 0 && (
          <div className="mt-4">
            <p className="lowkey text-xs font-bold text-muted-foreground">trending in your band</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {trendingTags.map(([tag, count]) => (
                <Link
                  key={tag}
                  to="/app/tag/$tag"
                  params={{ tag }}
                  className="lowkey inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-primary-soft"
                >
                  <Hash className="size-3 text-primary" />
                  {tag}
                  <span className="text-[10px] text-muted-foreground">{count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {tab === "tags" ? (
          trendingTags.length === 0 ? (
            <p className="lowkey mt-8 text-center text-xs text-muted-foreground">
              no hashtags in your band yet — add #tags to your next post!
            </p>
          ) : null
        ) : (
          <>
            <h1 className="lowkey mt-5 text-sm font-bold">people in your band</h1>
        <ul className="mt-2 flex flex-col gap-2">
          {people.length === 0 && (
            <li className="lowkey text-xs text-muted-foreground">nobody matches that</li>
          )}
          {people.map((p) => {
            const following = state.follows.some(
              (f) => f.followerId === me?.id && f.followingId === p.id,
            );
            return (
              <li key={p.id} className="flex items-center gap-3">
                <Link to="/app/u/$handle" params={{ handle: p.handle }}>
                  <Avatar hue={p.avatarHue} label={p.displayName} src={p.avatarUrl} size={36} />
                </Link>
                <Link to="/app/u/$handle" params={{ handle: p.handle }} className="min-w-0 flex-1">
                  <span className="lowkey block truncate text-sm font-semibold">@{p.handle}</span>
                  <span className="lowkey block truncate text-xs text-muted-foreground">
                    {p.bio || "no bio"}
                  </span>
                </Link>
                <button
                  onClick={() => void toggleFollow(p.id)}
                  className={`lowkey rounded-full px-3 py-1.5 text-xs font-bold ${
                    following ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {following ? "following" : "follow"}
                </button>
              </li>
            );
          })}
        </ul>

        {term && (
          <>
            <h2 className="lowkey mt-6 text-sm font-bold">posts</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {hits.length === 0 && (
                <li className="lowkey text-xs text-muted-foreground">no posts match that</li>
              )}
              {hits.map((p) => (
                <li key={p.id} className="lowkey text-xs text-muted-foreground">
                  {p.caption}
                </li>
              ))}
            </ul>
          </>
        )}
          </>
        )}
      </div>
    </AppScreen>
  );
}
