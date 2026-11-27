import { describe, expect, it } from "bun:test";
import { rankFeedPosts } from "./rank";
import type { Post, PostHashtag } from "./types";

const NOW = new Date("2026-11-27T12:00:00Z").getTime();

function makePost(id: string, authorId: string, caption: string, hoursAgo = 2): Post {
  return {
    id,
    authorId,
    kind: "post",
    title: null,
    caption,
    posterHue: 45,
    mediaUrl: null,
    taggedHandle: null,
    topic: null,
    communityId: null,
    ageBand: "under_18",
    createdAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
  };
}

const emptyRanking = {
  hashtags: [] as PostHashtag[],
  likes: [] as { postId: string }[],
  comments: [] as { postId: string }[],
  interests: [] as string[],
  followingIds: new Set<string>(),
  affinity: {},
  seed: 42,
  now: NOW,
};

describe("rankFeedPosts", () => {
  const posts: Post[] = [
    makePost("p1", "u1", "skate park #skating"),
    makePost("p2", "u2", "new beat #music"),
    makePost("p3", "u3", "ranked match #gaming"),
    makePost("p4", "u4", "doodle #art"),
    makePost("p5", "u5", "sunset #photos"),
    makePost("p6", "u6", "ramen #food"),
  ];
  const hashtags: PostHashtag[] = [];

  it("keeps the same order for the same session seed", () => {
    const a = rankFeedPosts({ ...emptyRanking, posts, hashtags });
    const b = rankFeedPosts({ ...emptyRanking, posts, hashtags });
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it("reshuffles when the session seed changes", () => {
    const a = rankFeedPosts({ ...emptyRanking, posts, hashtags, seed: 101 });
    const b = rankFeedPosts({ ...emptyRanking, posts, hashtags, seed: 9999 });
    expect(a.map((p) => p.id)).not.toEqual(b.map((p) => p.id));
  });

  it("ranks posts with liked hashtags higher", () => {
    const ranked = rankFeedPosts({
      ...emptyRanking,
      posts,
      hashtags,
      affinity: { gaming: { score: 8, updatedAt: NOW } },
      seed: 7,
    });
    expect(ranked[0]?.id).toBe("p3");
  });

  it("ranks a newer post above an older post when engagement is equal", () => {
    const ranked = rankFeedPosts({
      ...emptyRanking,
      posts: [
        makePost("old", "old-author", "last month", 24 * 30),
        makePost("new", "new-author", "right now", 0),
      ],
    });
    expect(ranked.map((p) => p.id)).toEqual(["new", "old"]);
  });

  it("ranks a post with likes above an otherwise identical post without likes", () => {
    const ranked = rankFeedPosts({
      ...emptyRanking,
      posts: [
        makePost("quiet", "quiet-author", "quiet", 2),
        makePost("liked", "liked-author", "liked", 2),
      ],
      likes: Array.from({ length: 100 }, () => ({ postId: "liked" })),
    });
    expect(ranked.map((p) => p.id)).toEqual(["liked", "quiet"]);
  });

  it("weighs comments more than the same number of likes", () => {
    const ranked = rankFeedPosts({
      ...emptyRanking,
      posts: [
        makePost("liked", "liked-author", "liked", 2),
        makePost("discussed", "discussed-author", "discussed", 2),
      ],
      likes: Array.from({ length: 100 }, () => ({ postId: "liked" })),
      comments: Array.from({ length: 100 }, () => ({ postId: "discussed" })),
    });
    expect(ranked.map((p) => p.id)).toEqual(["discussed", "liked"]);
  });

  it("caps consecutive posts from the same author or same tag at 2", () => {
    const burst: Post[] = [
      makePost("a1", "same", "one #skating", 1),
      makePost("a2", "same", "two #skating", 1),
      makePost("a3", "same", "three #skating", 1),
      makePost("a4", "same", "four #skating", 1),
      makePost("b1", "other", "break #music", 3),
    ];
    const ranked = rankFeedPosts({
      ...emptyRanking,
      posts: burst,
      hashtags,
      interests: ["skating"],
      followingIds: new Set(["same"]),
      affinity: { skating: { score: 10, updatedAt: NOW } },
      seed: 1,
    });
    const ids = ranked.map((p) => p.authorId);
    // The 3rd item must not be "same" because "other" is available
    expect(ids.slice(0, 3)).toEqual(["same", "same", "other"]);
  });
});
