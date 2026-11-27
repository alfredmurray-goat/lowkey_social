ALTER TABLE public.post_comments
  ADD COLUMN parent_id uuid;

ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_id_post_id_unique UNIQUE (id, post_id);

ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_parent_same_post_fk
  FOREIGN KEY (parent_id, post_id)
  REFERENCES public.post_comments (id, post_id)
  ON DELETE CASCADE;

CREATE INDEX post_comments_parent_id_idx
  ON public.post_comments (parent_id);