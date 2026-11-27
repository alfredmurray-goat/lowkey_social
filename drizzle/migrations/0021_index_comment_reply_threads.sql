CREATE INDEX post_comments_parent_post_idx
  ON public.post_comments (parent_id, post_id);