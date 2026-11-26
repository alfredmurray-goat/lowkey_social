import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppScreen } from "@/components/lowkey/shell";
import { ScribbleLoader } from "@/components/lowkey/scribble-loader";
import { useLowkey } from "@/lib/lowkey/store";

export const Route = createFileRoute("/app/join/$token")({
  head: () => ({
    meta: [
      { title: "join community — lowkey_social" },
      { name: "description", content: "join a class or friend community on lowkey_social." },
      { property: "og:title", content: "join community — lowkey_social" },
      { property: "og:description", content: "join a community in your age band." },
    ],
  }),
  component: JoinCommunityPage,
});

function JoinCommunityPage() {
  const { token } = Route.useParams();
  const { me, loading, joinCommunity } = useLowkey();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !me) return;
    let cancelled = false;
    void (async () => {
      const res = await joinCommunity(token);
      if (cancelled) return;
      if (res.ok && res.communityId) {
        void navigate({ to: "/app/community/$id", params: { id: res.communityId }, replace: true });
      } else {
        setError(res.error ?? "couldn't join this community");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, me, token, joinCommunity, navigate]);

  return (
    <AppScreen title="join community">
      {error ? (
        <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="lowkey text-lg font-extrabold">couldn&apos;t join</p>
          <p className="lowkey text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => void navigate({ to: "/app" })}
            className="lowkey mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            back to feed
          </button>
        </div>
      ) : (
        <ScribbleLoader fullScreen label="joining community…" />
      )}
    </AppScreen>
  );
}