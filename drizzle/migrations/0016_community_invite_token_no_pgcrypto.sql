CREATE OR REPLACE FUNCTION public.create_community(
  _name text,
  _emoji text DEFAULT '🏫',
  _description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me_id uuid := public.current_profile_id();
  me_band public.age_band := public.current_band();
  cid uuid;
  tok text := gen_random_uuid()::text;
BEGIN
  IF me_id IS NULL OR me_band IS NULL THEN
    RAISE EXCEPTION 'must be age-verified to create a community';
  END IF;
  IF trim(coalesce(_name, '')) = '' THEN
    RAISE EXCEPTION 'community name required';
  END IF;

  INSERT INTO public.communities (name, emoji, description, age_band, owner_id)
  VALUES (trim(_name), coalesce(nullif(trim(_emoji), ''), '🏫'), coalesce(trim(_description), ''), me_band, me_id)
  RETURNING id INTO cid;

  INSERT INTO public.community_members (community_id, profile_id, role)
  VALUES (cid, me_id, 'owner');

  INSERT INTO public.community_invites (community_id, token, created_by)
  VALUES (cid, tok, me_id);

  RETURN cid;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_group_to_community(
  _conv uuid,
  _name text DEFAULT NULL,
  _emoji text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me_id uuid := public.current_profile_id();
  me_band public.age_band := public.current_band();
  conv_row public.conversations%ROWTYPE;
  existing_cid uuid;
  cid uuid;
  tok text := gen_random_uuid()::text;
BEGIN
  IF me_id IS NULL OR me_band IS NULL THEN
    RAISE EXCEPTION 'must be age-verified';
  END IF;
  IF NOT public.is_conversation_member(_conv) THEN
    RAISE EXCEPTION 'not a member of this group';
  END IF;

  SELECT * INTO conv_row FROM public.conversations WHERE id = _conv;
  IF NOT FOUND OR NOT conv_row.is_group THEN
    RAISE EXCEPTION 'only group chats can become communities';
  END IF;

  SELECT id INTO existing_cid FROM public.communities WHERE conversation_id = _conv LIMIT 1;
  IF existing_cid IS NOT NULL THEN
    RETURN existing_cid;
  END IF;

  INSERT INTO public.communities (name, emoji, description, age_band, owner_id, conversation_id)
  VALUES (
    coalesce(nullif(trim(_name), ''), nullif(trim(conv_row.title), ''), 'our class'),
    coalesce(nullif(trim(_emoji), ''), nullif(trim(conv_row.emoji), ''), '🏫'),
    'started from a group chat',
    conv_row.age_band,
    me_id,
    _conv
  )
  RETURNING id INTO cid;

  INSERT INTO public.community_members (community_id, profile_id, role)
  SELECT cid, cm.profile_id, CASE WHEN cm.profile_id = me_id THEN 'owner' ELSE 'member' END
  FROM public.conversation_members cm
  WHERE cm.conversation_id = _conv
  ON CONFLICT DO NOTHING;

  INSERT INTO public.community_invites (community_id, token, created_by)
  VALUES (cid, tok, me_id);

  RETURN cid;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_community_invite(_community_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me_id uuid := public.current_profile_id();
  tok text := gen_random_uuid()::text;
BEGIN
  IF NOT public.is_community_admin(_community_id) THEN
    RAISE EXCEPTION 'only community admins can reset the invite';
  END IF;

  UPDATE public.community_invites
  SET revoked_at = now()
  WHERE community_id = _community_id AND revoked_at IS NULL;

  INSERT INTO public.community_invites (community_id, token, created_by)
  VALUES (_community_id, tok, me_id);

  RETURN tok;
END;
$$;