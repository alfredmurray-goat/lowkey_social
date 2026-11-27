DROP POLICY IF EXISTS "band posts readable" ON public.posts;
CREATE POLICY "band posts readable"
ON public.posts
FOR SELECT
TO authenticated
USING (
  age_band = public.current_band()
  AND (
    community_id IS NULL
    OR public.is_community_member(community_id)
  )
);

DROP POLICY IF EXISTS "Band members read hashtags" ON public.post_hashtags;
CREATE POLICY "Band members read hashtags"
ON public.post_hashtags
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::text)
  OR (
    age_band = public.current_band()
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_hashtags.post_id
        AND (p.community_id IS NULL OR public.is_community_member(p.community_id))
    )
  )
);