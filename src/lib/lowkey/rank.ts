import type { Post, PostHashtag } from "./types";

const TAG_RE = /#([\p{L}\p{N}_-]{2,32})/gu;
const MENTION_RE = /(?:^|[\s([{"'])@([a-z0-9_.-]{2,30})\b/gi;
const AFFINITY_KEY = "lowkey.tagAffinity.v1";

export type TagAffinityMap = Record<string, { score: number; updatedAt: number }>;

/** One random seed per app open — reshuffles on every launch, stable while scrolling. */
export const SESSION_FEED_SEED = Math.floor(Math.random() * 0x7fffffff) || 1337;

export function extractTagsFromCaption(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) {
    const raw = m[1];
    if (raw) out.add(raw.toLowerCase());
  }
  return [...out];
}

export function extractMentions(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) {
    const raw = m[1];
    if (raw) out.add(raw.toLowerCase());
  }
  return [...out];
}

export function getPostTags(post: Post, hashtags: PostHashtag[]): string[] {
  const set = new Set<string>(extractTagsFromCaption(post.caption));
  for (const h of hashtags) {
    if (h.postId === post.id && h.tag) set.add(h.tag.toLowerCase());
  }
  return [...set];
}

export function readTagAffinity(): TagAffinityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(AFFINITY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as TagAffinityMap;
  } catch {
    return {};
  }
}

export function recordTagSignal(tags: string[], weight: number, now = Date.now()): TagAffinityMap {
  if (typeof window === "undefined" || tags.length === 0 || weight <= 0) return readTagAffinity();
  const current = readTagAffinity();
  const next: TagAffinityMap = { ...current };
  for (const raw of tags) {
    const tag = raw.toLowerCase().replace(/^#/, "");
    if (!tag) continue;
    const prev = next[tag];
    const decayed = prev ? decayScore(prev.score, now - prev.updatedAt) : 0;
    next[tag] = { score: Math.min(25, decayed + weight), updatedAt: now };
  }
  try {
    window.localStorage.setItem(AFFINITY_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

function decayScore(score: number, ageMs: number): number {
  if (ageMs <= 0) return score;
  const halfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7-day half-life
  return score * Math.pow(0.5, ageMs / halfLifeMs);
}

/** Deterministic 0..1 hash from (postId, seed) so order reshuffles per app open but never jumps mid-scroll. */
function seededUnit(id: string, seed: number): number {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 0xffffffff;
}

export interface RankInput {
  posts: Post[];
  hashtags: PostHashtag[];
  interests: string[];
  followingIds: Set<string>;
  affinity: TagAffinityMap;
  seed: number;
  now?: number;
}

/**
 * Computes trending tags in the current band (posts from the last 5 days).
 */
export function getTrendingTags(posts: Post[], hashtags: PostHashtag[], now = Date.now(), limit = 8): { tag: string; count: number }[] {
  const cutoff = now - 5 * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();
  for (const p of posts) {
    const ts = new Date(p.createdAt).getTime();
    if (Number.isFinite(ts) && ts < cutoff) continue;
    for (const t of getPostTags(p, hashtags)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/**
 * Ranks posts for the "for you" feed & short videos:
 * - user's hashtag affinity (likes, comments, bookmarks, video watches)
 * - trending tags in the band
 * - onboarding interests (matching topic or hashtag)
 * - people you follow
 * - recency
 * - seeded per-session shuffle jitter
 * Followed by a diversity pass so at most 2 posts in a row share an author or primary tag.
 */
export function rankFeedPosts(input: RankInput): Post[] {
  const { posts, hashtags, interests, followingIds, affinity, seed } = input;
  const now = input.now ?? Date.now();
  if (posts.length <= 1) return [...posts];

  const interestSet = new Set(interests.map((i) => i.toLowerCase().trim()).filter(Boolean));
  const trendingList = getTrendingTags(posts, hashtags, now, 12);
  const maxTrend = Math.max(1, trendingList[0]?.count ?? 1);
  const trendingMap = new Map(trendingList.map((t) => [t.tag, t.count / maxTrend]));

  const scored = posts.map((post) => {
    const tags = getPostTags(post, hashtags);
    let tagAffinity = 0;
    let trendingBoost = 0;
    let interestTagHit = false;

    for (const tag of tags) {
      const entry = affinity[tag];
      if (entry) {
        tagAffinity += decayScore(entry.score, now - entry.updatedAt);
      }
      const tr = trendingMap.get(tag);
      if (tr) trendingBoost = Math.max(trendingBoost, tr);
      if (interestSet.has(tag)) interestTagHit = true;
    }

    const topicHit = post.topic ? interestSet.has(post.topic.toLowerCase()) : false;
    const interestBoost = (topicHit ? 2.2 : 0) + (interestTagHit ? 2.8 : 0);
    const followBoost = followingIds.has(post.authorId) ? 2.5 : 0;

    const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 3_600_000);
    const recency = 4.0 / (1 + ageHours / 18);

    // Jitter is strong enough to reshuffle similar posts every app open
    const jitter = seededUnit(post.id, seed) * 3.5;

    const score =
      Math.min(12, tagAffinity * 1.4) +
      trendingBoost * 2.2 +
      interestBoost +
      followBoost +
      recency +
      jitter;

    return { post, score, primaryTag: tags[0] ?? null };
  });

  scored.sort((a, b) => b.score - a.score || a.post.id.localeCompare(b.post.id));

  // Diversity pass: avoid >2 consecutive posts from the same author or same primary tag
  const remaining = [...scored];
  const result: typeof scored = [];

  while (remaining.length > 0) {
    const last1 = result[result.length - 1];
    const last2 = result[result.length - 2];
    const blockedAuthor =
      last1 && last2 && last1.post.authorId === last2.post.authorId ? last1.post.authorId : null;
    const blockedTag =
      last1 && last2 && last1.primaryTag && last1.primaryTag === last2.primaryTag
        ? last1.primaryTag
        : null;

    let pickIdx = remaining.findIndex(
      (item) =>
        (!blockedAuthor || item.post.authorId !== blockedAuthor) &&
        (!blockedTag || item.primaryTag !== blockedTag),
    );
    if (pickIdx === -1) pickIdx = 0;
    const [picked] = remaining.splice(pickIdx, 1);
    if (picked) result.push(picked);
  }

  return result.map((r) => r.post);
}