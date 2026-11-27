import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Flame, Hash, Sparkles } from "lucide-react";
import { AppScreen, Avatar, Poster } from "@/components/lowkey/shell";
import { CaptionText } from "@/components/lowkey/caption-text";
import { isAiFeatureEnabled } from "@/lib/lowkey/ai-settings";
import { getTrendingTags } from "@/lib/lowkey/rank";
import { useBandPosts, useLowkey } from "@/lib/lowkey/store";
import { useTagHubs } from "@/lib/lowkey/tag-hubs";

export const Route = createFileRoute("/app/tag/$tag")({
  head: ({ params }) => ({
    meta: [
      { title: `#${params.tag} — lowkey_social` },
      { name: "description", content: `posts tagged #${params.tag} in your age band on lowkey_social.` },
      { property: "og:title", content: `#${params.tag} — lowkey_social` },
      { property: "og:description", content: `posts tagged #${params.tag} in your age band.` },
    ],
  }),
  component: TagPage,
});

function TagPage() {
  const { tag } = Route.useParams();
  const cleanTag = tag.toLowerCase().replace(/^#/, "");
  const { state, me } = useLowkey();
  const bandPosts = useBandPosts();
  const hubsOn = isAiFeatureEnabled(me?.aiSettings, "hubs");
  const hubs = useTagHubs(hubsOn);
  const activeHub = hubs.find((h) => h.name === cleanTag || h.tags.includes(cleanTag)) ?? null;
  const matchTags = new Set(activeHub ? [cleanTag, ...activeHub.tags] : [cleanTag]);
  const taggedIds = new Set(
    state.hashtags.filter((h) => matchTags.has(h.tag)).map((h) => h.postId),
  );
  const posts = bandPosts.filter(
    (p) =>
      taggedIds.has(p.id) ||
      [...matchTags].some((t) => p.caption.toLowerCase().includes(`#${t}`)),
  );
  const trending = getTrendingTags(bandPosts, state.hashtags, Date.now(), 8);

  return (
    <AppScreen title={`#${cleanTag}`}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <Link to="/app" className="rounded-full p-2 hover:bg-muted" aria-label="back to feed">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Hash className="size-5" />
        </div>
        <div>
          <h1 className="lowkey text-lg font-extrabold">#{cleanTag}</h1>
          <p className="lowkey text-xs text-muted-foreground">
            {posts.length} {posts.length === 1 ? "post" : "posts"} in your band
            {activeHub ? ` · hub: ${activeHub.tags.map((t) => `#${t}`).join(" ")}` : ""}
          </p>
        </div>
      </div>

      {hubs.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2.5">
          <span className="lowkey inline-flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> local hubs
          </span>
          {hubs.map((h) => (
            <Link
              key={h.id}
              to="/app/tag/$tag"
              params={{ tag: h.name }}
              className={`lowkey shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-transform active:scale-95 ${
                activeHub?.id === h.id ? "bg-primary text-primary-foreground" : "bg-primary-soft text-foreground"
              }`}
            >
              {h.name} ({h.tags.length})
            </Link>
          ))}
        </div>
      )}

      {trending.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-3">
          <span className="lowkey inline-flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground">
            <Flame className="size-3.5 text-primary" /> trending
          </span>
          {trending.map((t) => (
            <Link
              key={t.tag}
              to="/app/tag/$tag"
              params={{ tag: t.tag }}
              className={`lowkey shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-transform active:scale-95 ${
                t.tag === cleanTag ? "bg-primary text-primary-foreground" : "bg-primary-soft text-foreground"
              }`}
            >
              #{t.tag}
            </Link>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <p className="lowkey text-base font-bold">no posts with #{cleanTag} yet</p>
          <p className="lowkey text-sm text-muted-foreground">be the first to post with it.</p>
          <Link
            to="/app/create"
            className="lowkey mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            make a post
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {posts.map((p) => {
            const author = state.profiles.find((pr) => pr.id === p.authorId);
            if (!author) return null;
            return (
              <article key={p.id} className="flex flex-col gap-3 px-4 py-4">
                <Link
                  to="/app/u/$handle"
                  params={{ handle: author.handle }}
                  className="flex items-center gap-2.5"
                >
                  <Avatar hue={author.avatarHue} label={author.displayName} src={author.avatarUrl} size={34} />
                  <div>
                    <p className="lowkey text-sm font-bold">{author.displayName}</p>
                    <p className="lowkey text-xs text-muted-foreground">@{author.handle}</p>
                  </div>
                </Link>
                {p.title && <p className="lowkey text-base font-bold">{p.title}</p>}
                {p.mediaUrl && (
                  p.kind === "video" ? (
                    <video src={p.mediaUrl} controls playsInline className="max-h-96 w-full rounded-2xl bg-muted object-cover" />
                  ) : (
                    <Poster hue={p.posterHue} caption={p.caption} mediaUrl={p.mediaUrl} />
                  )
                )}
                <p className="lowkey text-sm">
                  <CaptionText text={p.caption} />
                </p>
              </article>
            );
          })}
        </div>
      )}
    </AppScreen>
  );
}