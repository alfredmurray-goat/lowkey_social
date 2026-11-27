import type { Comment } from "./types";

export interface CommentThread extends Comment {
  replies: CommentThread[];
}

/** Groups replies beneath their parent while keeping every thread chronological. */
export function buildCommentThreads(comments: Comment[]): CommentThread[] {
  const ordered = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const knownIds = new Set(ordered.map((comment) => comment.id));
  const repliesByParent = new Map<string, Comment[]>();
  const roots: Comment[] = [];

  for (const comment of ordered) {
    if (comment.parentId && comment.parentId !== comment.id && knownIds.has(comment.parentId)) {
      const replies = repliesByParent.get(comment.parentId) ?? [];
      replies.push(comment);
      repliesByParent.set(comment.parentId, replies);
    } else {
      // Old comments and orphaned rows remain visible as top-level comments.
      roots.push(comment);
    }
  }

  const attachReplies = (comment: Comment): CommentThread => ({
    ...comment,
    replies: (repliesByParent.get(comment.id) ?? []).map(attachReplies),
  });

  return roots.map(attachReplies);
}
