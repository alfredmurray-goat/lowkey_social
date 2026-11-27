import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Bookmark, Captions, Heart, MessageSquare, Music2, Play, Send, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppScreen, Poster } from "@/components/lowkey/shell";
import { CommentsSheet } from "@/components/lowkey/comments";
import { CaptionText } from "@/components/lowkey/caption-text";
import { extractTagsFromCaption, recordTagSignal } from "@/lib/lowkey/rank";
import { useBandPosts, useLowkey } from "@/lib/lowkey/store";
import type { Post } from "@/lib/lowkey/types";

export const Route = createFileRoute("/app/videos")({
  head: () => ({
    meta: [
      { title: "videos — lowkey_social" },
      {
        name: "description",
        content: "full-screen lowkey videos from creators in your own age band.",
      },
      { property: "og:title", content: "videos — lowkey_social" },
      { property: "og:description", content: "full-screen videos from your age band." },
    ],
  }),
  component: VideosPage,
});

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|heif)(\?|$)/i;

/** a "video" post whose file is actually an image can never play — treat it as a poster */
function playableVideo(post: Post) {
  return Boolean(post.mediaUrl && !IMAGE_EXT.test(post.mediaUrl));
}

function VideoCard({
  post,
  muted,
  showSubs,
  onToggleMute,
  onToggleSubs,
  onComments,
}: {
  post: Post;
  muted: boolean;
  showSubs: boolean;
  onToggleMute: () => void;
  onToggleSubs: () => void;
  onComments: () => void;
}) {
  const { state, me, toggleLike, toggleFollow, toggleBookmark } = useLowkey();
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [subLine, setSubLine] = useState("");
  const songRef = useRef<HTMLAudioElement | null>(null);

  const subChunks = useMemo(() => {
    if (!post.caption.trim()) return [];
    const words = post.caption.trim().split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 5) {
      chunks.push(words.slice(i, i + 5).join(" "));
    }
    return chunks;
  }, [post.caption]);

  const syncSubtitle = (el: HTMLVideoElement | null) => {
    if (!showSubs || subChunks.length === 0) {
      setSubLine("");
      return;
    }
    if (!el) {
      setSubLine(subChunks[0] ?? "");
      return;
    }
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    const idx =
      dur > 0
        ? Math.min(subChunks.length - 1, Math.floor(((el.currentTime % dur) / dur) * subChunks.length))
        : Math.floor(el.currentTime / 2.2) % subChunks.length;
    setSubLine(subChunks[idx] ?? "");
  };

  useEffect(() => {
    syncSubtitle(ref.current);
  }, [showSubs, subChunks]);

  // keep the song in step with the video: plays/pauses together, follows mute
  useEffect(() => {
    const a = songRef.current;
    if (!a) return;
    a.muted = muted;
    if (playing) void a.play().catch(() => undefined);
    else a.pause();
  }, [playing, muted]);

  const author = state.profiles.find((p) => p.id === post.authorId);
  const likes = state.likes.filter((l) => l.postId === post.id);
  const liked = likes.some((l) => l.profileId === me?.id);
  const comments = state.comments.filter((c) => c.postId === post.id).length;
  const following = state.follows.some(
    (f) => f.followerId === me?.id && f.followingId === author?.id,
  );
  const canPlay = playableVideo(post);

  // autoplay whatever is on screen, pause everything else
  useEffect(() => {
    const el = ref.current;
    if (!el || !canPlay) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) void el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canPlay]);

  if (!author) return null;

  const authorLink =
    author.id === me?.id
      ? { to: "/app/profile" as const }
      : { to: "/app/u/$handle" as const, params: { handle: author.handle } };

  return (
    <section className="relative h-[calc(100vh-9rem)] snap-start px-3 py-2">
      <div className="relative h-full overflow-hidden rounded-3xl bg-muted">
        {canPlay ? (
          <>
            <video
              ref={ref}
              src={post.mediaUrl ?? undefined}
              className="h-full w-full object-cover"
              playsInline
              loop
              muted={muted}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => {
                syncSubtitle(e.currentTarget);
                const el = e.currentTarget;
                if (el.currentTime >= 4 && !el.dataset["tagLogged"]) {
                  el.dataset["tagLogged"] = "1";
                  const tags = extractTagsFromCaption(post.caption);
                  if (tags.length > 0) recordTagSignal(tags, 1.5);
                }
              }}
              onLoadedMetadata={(e) => syncSubtitle(e.currentTarget)}
            />
            <button
              aria-label={playing ? "pause video" : "play video"}
              onClick={() => {
                const el = ref.current;
                if (!el) return;
                if (el.paused) void el.play().catch(() => undefined);
                else el.pause();
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {!playing && (
                <span className="flex size-16 items-center justify-center rounded-full bg-background/80">
                  <Play className="size-7" />
                </span>
              )}
            </button>
            <button
              onClick={() => {
                onToggleMute();
                // a tap is a user gesture, so browsers allow sound to start here
                if (muted && playing) void songRef.current?.play().catch(() => undefined);
              }}
              aria-label={muted ? "unmute" : "mute"}
              className="absolute top-4 left-4 flex h-10 w-11 items-center justify-center rounded-2xl bg-card/85 shadow-xs backdrop-blur-sm transition-transform active:scale-90"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button
              onClick={onToggleSubs}
              aria-label={showSubs ? "hide subtitles" : "show subtitles"}
              className={`absolute top-16 left-4 flex h-10 w-11 items-center justify-center rounded-2xl shadow-xs backdrop-blur-sm transition-all active:scale-90 ${
                showSubs ? "bg-primary text-primary-foreground" : "bg-card/85 text-foreground"
              }`}
            >
              <Captions className="size-4" />
            </button>
          </>
        ) : (
          <Poster hue={post.posterHue} caption={post.caption} aspect="tall" />
        )}

        <div className="absolute top-4 right-4 flex flex-col items-center gap-5">
          <button
            onClick={() => void toggleLike(post.id)}
            aria-label="like"
            className="flex flex-col items-center text-foreground/80"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-background/70">
              <Heart className={liked ? "size-5 fill-primary text-primary" : "size-5"} />
            </span>
            <span className="text-xs font-bold">{likes.length}</span>
          </button>
          <button
            onClick={onComments}
            aria-label="comments"
            className="flex flex-col items-center text-foreground/80"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-background/70">
              <MessageSquare className="size-5" />
            </span>
            <span className="text-xs font-bold">{comments}</span>
          </button>
          <Link to="/app/chats" aria-label="share" className="text-foreground/80">
            <span className="flex size-11 items-center justify-center rounded-full bg-background/70">
              <Send className="size-5" />
            </span>
          </Link>
          <button
            onClick={() => void toggleBookmark(post.id)}
            aria-label="save video"
            className="text-foreground/80"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-background/70">
              <Bookmark
                className={
                  state.bookmarks.includes(post.id)
                    ? "size-5 fill-primary text-primary"
                    : "size-5"
                }
              />
            </span>
          </button>
        </div>

        {showSubs && subLine && (
          <div className="pointer-events-none absolute inset-x-6 bottom-32 flex justify-center">
            <span className="lowkey rounded-xl bg-foreground/85 px-3.5 py-1.5 text-center text-sm font-bold text-background shadow-sm backdrop-blur-xs">
              {subLine}
            </span>
          </div>
        )}

        <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-background/70 p-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Link {...authorLink} className="lowkey flex items-center gap-1 text-sm font-bold">
              @{author.handle}
              <BadgeCheck className="size-4 text-primary" />
            </Link>
            {author.id !== me?.id && (
              <button
                onClick={() => void toggleFollow(author.id)}
                className={`lowkey rounded-full px-3 py-1 text-[11px] font-bold ${
                  following ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                {following ? "following" : "follow"}
              </button>
            )}
          </div>
          {post.caption && (
            <p className="lowkey mt-1 text-xs">
              <CaptionText text={post.caption} chips />
            </p>
          )}
          {post.songTitle && (
            <div className="lowkey mt-2 text-xs">
              <p className="flex items-center gap-1.5"><Music2 className="size-3.5" />song playing is: <strong>{post.songTitle} — {post.songArtist}</strong></p>
            </div>
          )}
          {post.audioUrl && <audio ref={songRef} src={post.audioUrl} loop preload="auto" />}
        </div>
      </div>
    </section>
  );
}

function VideosPage() {
  const { state, me } = useLowkey();
  const allVideos = useBandPosts("video");
  const [muted, setMuted] = useState(true);
  const [showSubs, setShowSubs] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<string>("all");
  const [openComments, setOpenComments] = useState<string | null>(null);

  const myCommunities = state.communities.filter((c) => me && c.memberIds.includes(me.id));
  const videos = allVideos.filter((v) =>
    selectedCommunity === "all"
      ? !v.communityId || myCommunities.some((c) => c.id === v.communityId)
      : v.communityId === selectedCommunity,
  );

  return (
    <AppScreen>
      <h1 className="sr-only">lowkey videos</h1>
      {myCommunities.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2">
          <button
            onClick={() => setSelectedCommunity("all")}
            className={`lowkey shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
              selectedCommunity === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            }`}
          >
            all
          </button>
          {myCommunities.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCommunity(c.id)}
              className={`lowkey shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
                selectedCommunity === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="h-[calc(100vh-11rem)] snap-y snap-mandatory overflow-y-auto">
        {videos.length === 0 && (
          <p className="lowkey p-8 text-center text-sm text-muted-foreground">
            no videos in your band yet. record one.
          </p>
        )}
        {videos.map((v) => (
          <VideoCard
            key={v.id}
            post={v}
            muted={muted}
            showSubs={showSubs}
            onToggleMute={() => setMuted((m) => !m)}
            onToggleSubs={() => setShowSubs((s) => !s)}
            onComments={() => setOpenComments(v.id)}
          />
        ))}
      </div>
      {openComments && (
        <CommentsSheet postId={openComments} onClose={() => setOpenComments(null)} />
      )}
    </AppScreen>
  );
}
