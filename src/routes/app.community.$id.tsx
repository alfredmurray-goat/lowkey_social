import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Copy, QrCode, RefreshCw, Settings2, Users } from "lucide-react";
import { toast } from "sonner";
import { AppScreen, Avatar, Poster } from "@/components/lowkey/shell";
import { CaptionText } from "@/components/lowkey/caption-text";
import { useLowkey } from "@/lib/lowkey/store";

export const Route = createFileRoute("/app/community/$id")({
  head: () => ({
    meta: [
      { title: "community — lowkey_social" },
      { name: "description", content: "your class or group community feed on lowkey_social." },
      { property: "og:title", content: "community — lowkey_social" },
      { property: "og:description", content: "your class or group community feed." },
    ],
  }),
  component: CommunityPage,
});

const EMOJIS = ["🏫", "⚽", "🎮", "🎨", "🎵", "📚", "🔥", "✨", "🛹", "🍕"];

function CommunityPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { state, me, resetCommunityInvite, updateCommunity, removeCommunityMember } = useLowkey();
  const community = state.communities.find((c) => c.id === id);
  const [tab, setTab] = useState<"feed" | "members" | "invite" | "settings">("feed");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [name, setName] = useState(community?.name ?? "");
  const [emoji, setEmoji] = useState(community?.emoji ?? "🏫");
  const [desc, setDesc] = useState(community?.description ?? "");

  useEffect(() => {
    if (community) {
      setName(community.name);
      setEmoji(community.emoji);
      setDesc(community.description);
    }
  }, [community]);

  const inviteLink =
    typeof window !== "undefined" && community?.inviteToken
      ? `${window.location.origin}/app/join/${community.inviteToken}`
      : "";

  useEffect(() => {
    if (!inviteLink) {
      setQrUrl(null);
      return;
    }
    void QRCode.toDataURL(inviteLink, { width: 240, margin: 2 }).then(setQrUrl).catch(() => setQrUrl(null));
  }, [inviteLink]);

  if (!community) {
    return (
      <AppScreen title="community">
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="lowkey text-base font-bold">community not found</p>
          <Link to="/app" className="lowkey rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
            back to feed
          </Link>
        </div>
      </AppScreen>
    );
  }

  const isOwner = community.ownerId === me?.id;
  const posts = state.posts.filter((p) => p.communityId === community.id);
  const members = community.memberIds
    .map((pid) => state.profiles.find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <AppScreen title={community.name}>
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="rounded-full p-2 hover:bg-muted" aria-label="back">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-2xl">
            {community.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="lowkey truncate text-lg font-extrabold">{community.name}</h1>
            <p className="lowkey truncate text-xs text-muted-foreground">
              {members.length} {members.length === 1 ? "member" : "members"}
              {community.description ? ` · ${community.description}` : ""}
            </p>
          </div>
          {community.conversationId && (
            <Link
              to="/app/chat/$id"
              params={{ id: community.conversationId }}
              className="lowkey rounded-full border border-border px-3 py-1.5 text-xs font-bold"
            >
              chat
            </Link>
          )}
        </div>

        <div className="mt-4 flex gap-1 rounded-full bg-muted p-1">
          {(
            [
              ["feed", "feed"],
              ["members", "members"],
              ["invite", "qr invite"],
              ["settings", "settings"],
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
      </div>

      {tab === "feed" && (
        <div className="divide-y divide-border">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <p className="lowkey text-base font-bold">no posts in {community.name} yet</p>
              <p className="lowkey text-sm text-muted-foreground">
                pick this community on the create page to post here.
              </p>
              <Link
                to="/app/create"
                className="lowkey mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                post to {community.name}
              </Link>
            </div>
          ) : (
            posts.map((p) => {
              const author = state.profiles.find((pr) => pr.id === p.authorId);
              if (!author) return null;
              return (
                <article key={p.id} className="flex flex-col gap-2.5 px-4 py-4">
                  <Link to="/app/u/$handle" params={{ handle: author.handle }} className="flex items-center gap-2">
                    <Avatar hue={author.avatarHue} label={author.displayName} src={author.avatarUrl} size={32} />
                    <span className="lowkey text-sm font-bold">{author.displayName}</span>
                    <span className="lowkey text-xs text-muted-foreground">@{author.handle}</span>
                  </Link>
                  {p.title && (
                    <p className="lowkey text-base font-bold">
                      <CaptionText text={p.title} />
                    </p>
                  )}
                  {p.mediaUrl && (
                    p.kind === "video" ? (
                      <video src={p.mediaUrl} controls playsInline className="max-h-96 w-full rounded-2xl bg-muted object-cover" />
                    ) : (
                      <Poster hue={p.posterHue} caption={p.caption} mediaUrl={p.mediaUrl} mediaUrls={p.mediaUrls ?? []} />
                    )
                  )}
                  <p className="lowkey text-sm">
                    <CaptionText text={p.caption} />
                  </p>
                </article>
              );
            })
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="flex flex-col gap-2 p-4">
          <p className="lowkey flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Users className="size-3.5" /> {members.length} people in this community
          </p>
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
              <Link to="/app/u/$handle" params={{ handle: m.handle }} className="flex items-center gap-2.5">
                <Avatar hue={m.avatarHue} label={m.displayName} src={m.avatarUrl} size={36} />
                <div>
                  <p className="lowkey text-sm font-bold">
                    {m.displayName}{" "}
                    {m.id === community.ownerId && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold">owner</span>
                    )}
                  </p>
                  <p className="lowkey text-xs text-muted-foreground">@{m.handle}</p>
                </div>
              </Link>
              {isOwner && m.id !== me?.id && (
                <button
                  onClick={() => void removeCommunityMember(community.id, m.id)}
                  className="lowkey rounded-full border border-destructive/40 px-3 py-1 text-xs font-semibold text-destructive"
                >
                  remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "invite" && (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" />
            <h2 className="lowkey text-base font-extrabold">scan to join {community.name}</h2>
          </div>
          <p className="lowkey max-w-xs text-xs text-muted-foreground">
            anyone in your age band can scan this qr code or open the link to join your class community.
          </p>
          {qrUrl && (
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <img src={qrUrl} alt={`qr code to join ${community.name}`} className="size-56 rounded-2xl" />
            </div>
          )}
          <div className="flex w-full max-w-sm gap-2">
            <button
              onClick={async () => {
                if (!inviteLink) return;
                await navigator.clipboard.writeText(inviteLink);
                toast.success("invite link copied");
              }}
              className="lowkey flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-3 text-xs font-bold text-primary-foreground"
            >
              <Copy className="size-4" /> copy invite link
            </button>
            {isOwner && (
              <button
                onClick={async () => {
                  const tok = await resetCommunityInvite(community.id);
                  if (tok) toast.success("new qr & link generated");
                }}
                className="lowkey flex items-center gap-1.5 rounded-full border border-border px-4 py-3 text-xs font-bold"
              >
                <RefreshCw className="size-4" /> reset
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="flex flex-col gap-4 p-4">
          {isOwner && (
            <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4">
              <p className="lowkey flex items-center gap-1.5 text-sm font-bold">
                <Settings2 className="size-4" /> edit community
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="community name"
                className="lowkey rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none"
              />
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="short description"
                className="lowkey rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none"
              />
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setEmoji(em)}
                    className={`flex size-10 items-center justify-center rounded-2xl text-lg ${
                      emoji === em ? "bg-primary ring-2 ring-foreground" : "bg-muted"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <button
                onClick={async () => {
                  const ok = await updateCommunity(community.id, name, emoji, desc);
                  if (ok) toast.success("community saved");
                }}
                className="lowkey rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground"
              >
                save changes
              </button>
            </div>
          )}
          <button
            onClick={async () => {
              if (!me) return;
              const ok = await removeCommunityMember(community.id, me.id);
              if (ok) {
                toast.success("left community");
                void navigate({ to: "/app" });
              }
            }}
            className="lowkey rounded-full border border-destructive/40 py-3 text-sm font-bold text-destructive"
          >
            leave community
          </button>
        </div>
      )}
    </AppScreen>
  );
}