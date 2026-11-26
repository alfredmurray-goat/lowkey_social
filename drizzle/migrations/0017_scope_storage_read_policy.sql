CREATE OR REPLACE FUNCTION public.can_read_storage_object(_bucket_id text, _name text, _owner_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _owner_id = (auth.uid())::text
    OR (storage.foldername(_name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin')
    OR (
      _bucket_id = 'avatars'
      AND public.current_band() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id::text = COALESCE(_owner_id, (storage.foldername(_name))[1])
          AND p.age_band = public.current_band()
          AND p.banned_at IS NULL
      )
    )
    OR (
      _bucket_id = 'media'
      AND (
        EXISTS (
          SELECT 1
          FROM public.posts po
          WHERE (po.media_url = _name OR po.audio_path = _name OR po.cover_path = _name)
            AND po.age_band = public.current_band()
            AND (po.community_id IS NULL OR public.is_community_member(po.community_id))
        )
        OR EXISTS (
          SELECT 1
          FROM public.post_media pm
          JOIN public.posts po ON po.id = pm.post_id
          WHERE pm.storage_path = _name
            AND po.age_band = public.current_band()
            AND (po.community_id IS NULL OR public.is_community_member(po.community_id))
        )
        OR EXISTS (
          SELECT 1
          FROM public.messages m
          WHERE m.media_path = _name
            AND public.is_conversation_member(m.conversation_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.super_posts sp
          WHERE sp.media_url = _name
            AND public.current_band() IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM public.music_tracks mt
          WHERE mt.storage_path = _name
            AND mt.is_catalog = true
        )
      )
    );
$$;

DROP POLICY IF EXISTS "read lowkey media" ON storage.objects;

CREATE POLICY "read lowkey media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('avatars', 'media')
  AND (
    owner_id = (select auth.uid()::text)
    OR (storage.foldername(name))[1] = (select auth.uid()::text)
    OR public.can_read_storage_object(bucket_id, name, owner_id)
  )
);