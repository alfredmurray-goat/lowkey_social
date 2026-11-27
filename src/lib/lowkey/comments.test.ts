import { describe, expect, it } from "bun:test";
import { buildCommentThreads } from "./comments";
import type { Comment } from "./types";

function comment(id: string, parentId: string | null, createdAt: string): Comment {
  return {
    id,
    postId: "post-1",
    authorId: `author-${id}`,
    body: id,
    parentId,
    createdAt,
  };
}

describe("buildCommentThreads", () => {
  it("places each reply directly beneath the comment it replies to", () => {
    const threads = buildCommentThreads([
      comment("another-root", null, "2026-11-27T12:03:00Z"),
      comment("reply", "parent", "2026-11-27T12:02:00Z"),
      comment("parent", null, "2026-11-27T12:00:00Z"),
      comment("another-comment", null, "2026-11-27T12:01:00Z"),
    ]);

    expect(threads.map((thread) => thread.id)).toEqual(["parent", "another-comment", "another-root"]);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual(["reply"]);
    expect(threads[1]?.replies).toEqual([]);
  });

  it("keeps replies to replies in the same nested thread", () => {
    const threads = buildCommentThreads([
      comment("nested", "reply", "2026-11-27T12:02:00Z"),
      comment("reply", "parent", "2026-11-27T12:01:00Z"),
      comment("parent", null, "2026-11-27T12:00:00Z"),
    ]);

    expect(threads[0]?.replies[0]?.replies[0]?.id).toBe("nested");
  });
});
