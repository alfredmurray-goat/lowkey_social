-- 1. Profiles: onboarding v2, city_key, and new settings
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS school text,
  ADD COLUMN IF NOT EXISTS class_name text,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS heard_from text,
  ADD COLUMN IF NOT EXISTS safety_pledge_at timestamptz,
  ADD COLUMN IF NOT EXISTS city_key text,
  ADD COLUMN IF NOT EXISTS muted_words text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS muted_profile_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS break_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hide_reposts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_hashtags boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_community_invites text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS show_city text NOT NULL DEFAULT 'band',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- 2. City normalization function + backfill + trigger
CREATE OR REPLACE FUNCTION public.normalize_city_key(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  IF _raw IS NULL THEN
    RETURN NULL;
  END IF;
  cleaned := lower(trim(_raw));
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;
  cleaned := replace(cleaned, 'ø', 'o');
  cleaned := replace(cleaned, 'ö', 'o');
  cleaned := replace(cleaned, 'æ', 'ae');
  cleaned := replace(cleaned, 'ä', 'a');
  cleaned := replace(cleaned, 'å', 'aa');
  cleaned := replace(cleaned, 'ü', 'u');
  cleaned := replace(cleaned, 'é', 'e');
  cleaned := replace(cleaned, 'è', 'e');
  cleaned := regexp_replace(cleaned, '[^a-z0-9]+', ' ', 'g');
  cleaned := trim(cleaned);

  IF cleaned IN ('kobenhavn', 'koebenhavn', 'kbh', 'copenhagen', 'cph', 'kbh k', 'kbh n', 'kbh s', 'kbh v', 'kbh o', 'frederiksberg') THEN
    RETURN 'copenhagen';
  ELSIF cleaned IN ('aarhus', 'arhus', 'aarhus c', 'aarhus n', 'aarhus v') THEN
    RETURN 'aarhus';
  ELSIF cleaned IN ('odense', 'odense c', 'odense m', 'odense s') THEN
    RETURN 'odense';
  ELSIF cleaned IN ('aalborg', 'alborg') THEN
    RETURN 'aalborg';
  ELSIF cleaned IN ('malmo', 'malmoe') THEN
    RETURN 'malmo';
  ELSIF cleaned IN ('goteborg', 'gothenburg') THEN
    RETURN 'gothenburg';
  ELSIF cleaned IN ('stockholm', 'sthlm') THEN
    RETURN 'stockholm';
  ELSIF cleaned IN ('oslo') THEN
    RETURN 'oslo';
  ELSIF cleaned IN ('berlin') THEN
    RETURN 'berlin';
  ELSIF cleaned IN ('london', 'ldn') THEN
    RETURN 'london';
  ELSIF cleaned IN ('new york', 'nyc', 'new york city') THEN
    RETURN 'new york';
  ELSIF cleaned IN ('los angeles', 'la') THEN
    RETURN 'los angeles';
  END IF;

  RETURN cleaned;
END;
$$;

UPDATE public.profiles
SET city_key = public.normalize_city_key(city)
WHERE city IS NOT NULL AND city_key IS NULL;

CREATE OR REPLACE FUNCTION public.sync_profile_city_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.city_key := public.normalize_city_key(NEW.city);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_city_key ON public.profiles;
CREATE TRIGGER trg_profiles_city_key
BEFORE INSERT OR UPDATE OF city ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_city_key();

-- 3. Communities
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  emoji text NOT NULL DEFAULT '🏫',
  age_band public.age_band NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;

CREATE TABLE IF NOT EXISTS public.community_members (
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;

CREATE TABLE IF NOT EXISTS public.community_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_invites TO authenticated;
GRANT ALL ON public.community_invites TO service_role;

CREATE OR REPLACE FUNCTION public.is_community_member(_community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members
    WHERE community_id = _community_id
      AND profile_id = public.current_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_admin(_community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members
    WHERE community_id = _community_id
      AND profile_id = public.current_profile_id()
      AND role IN ('owner', 'admin')
  );
$$;

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own communities"
ON public.communities FOR SELECT TO authenticated
USING (public.is_community_member(id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update own communities"
ON public.communities FOR UPDATE TO authenticated
USING (public.is_community_admin(id))
WITH CHECK (public.is_community_admin(id));

CREATE POLICY "Owners delete own communities"
ON public.communities FOR DELETE TO authenticated
USING (owner_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members read community members"
ON public.community_members FOR SELECT TO authenticated
USING (public.is_community_member(community_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members read active invites"
ON public.community_invites FOR SELECT TO authenticated
USING (public.is_community_member(community_id) OR public.has_role(auth.uid(), 'admin'));

-- 4. Community RPCs
CREATE OR REPLACE FUNCTION public.create_community(_name text, _emoji text DEFAULT '🏫', _description text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id uuid := public.current_profile_id();
  me_band public.age_band := public.current_band();
  cid uuid;
  tok text := encode(gen_random_bytes(12), 'hex');
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

CREATE OR REPLACE FUNCTION public.convert_group_to_community(_conv uuid, _name text DEFAULT NULL, _emoji text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id uuid := public.current_profile_id();
  me_band public.age_band := public.current_band();
  conv_row public.conversations%ROWTYPE;
  existing_cid uuid;
  cid uuid;
  tok text := encode(gen_random_bytes(12), 'hex');
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

CREATE OR REPLACE FUNCTION public.join_community(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id uuid := public.current_profile_id();
  me_band public.age_band := public.current_band();
  inv_cid uuid;
  c_band public.age_band;
BEGIN
  IF me_id IS NULL OR me_band IS NULL THEN
    RAISE EXCEPTION 'verify your age first to join a community';
  END IF;

  SELECT ci.community_id, c.age_band
  INTO inv_cid, c_band
  FROM public.community_invites ci
  JOIN public.communities c ON c.id = ci.community_id
  WHERE ci.token = trim(_token)
    AND ci.revoked_at IS NULL
  LIMIT 1;

  IF inv_cid IS NULL THEN
    RAISE EXCEPTION 'invite link is invalid or expired';
  END IF;

  IF c_band <> me_band THEN
    RAISE EXCEPTION 'this community is in a different age band';
  END IF;

  INSERT INTO public.community_members (community_id, profile_id, role)
  VALUES (inv_cid, me_id, 'member')
  ON CONFLICT (community_id, profile_id) DO NOTHING;

  RETURN inv_cid;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_community_invite(_community_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id uuid := public.current_profile_id();
  tok text := encode(gen_random_bytes(12), 'hex');
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

CREATE OR REPLACE FUNCTION public.update_community(_community_id uuid, _name text, _emoji text, _description text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_community_admin(_community_id) THEN
    RAISE EXCEPTION 'only community admins can edit this community';
  END IF;
  UPDATE public.communities
  SET
    name = coalesce(nullif(trim(_name), ''), name),
    emoji = coalesce(nullif(trim(_emoji), ''), emoji),
    description = coalesce(trim(_description), description)
  WHERE id = _community_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_community_member(_community_id uuid, _member uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id uuid := public.current_profile_id();
  was_owner boolean;
  next_owner uuid;
BEGIN
  IF me_id IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF _member <> me_id AND NOT public.is_community_admin(_community_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT (owner_id = _member) INTO was_owner FROM public.communities WHERE id = _community_id;
  DELETE FROM public.community_members WHERE community_id = _community_id AND profile_id = _member;

  IF was_owner THEN
    SELECT profile_id INTO next_owner
    FROM public.community_members
    WHERE community_id = _community_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF next_owner IS NULL THEN
      DELETE FROM public.communities WHERE id = _community_id;
    ELSE
      UPDATE public.communities SET owner_id = next_owner WHERE id = _community_id;
      UPDATE public.community_members SET role = 'owner'
      WHERE community_id = _community_id AND profile_id = next_owner;
    END IF;
  END IF;
END;
$$;

-- 5. Posts: link to optional community
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_community_id ON public.posts(community_id) WHERE community_id IS NOT NULL;

-- 6. Hashtags
CREATE TABLE IF NOT EXISTS public.post_hashtags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tag text NOT NULL,
  age_band public.age_band NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, tag)
);

GRANT SELECT, INSERT, DELETE ON public.post_hashtags TO authenticated;
GRANT ALL ON public.post_hashtags TO service_role;

ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members read hashtags"
ON public.post_hashtags FOR SELECT TO authenticated
USING (age_band = public.current_band() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_post_hashtags_band_tag ON public.post_hashtags(age_band, tag);

CREATE OR REPLACE FUNCTION public.sync_post_hashtags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m text[];
BEGIN
  DELETE FROM public.post_hashtags WHERE post_id = NEW.id;
  FOR m IN
    SELECT regexp_matches(coalesce(NEW.caption, '') || ' ' || coalesce(NEW.title, ''), '#([a-zA-Z0-9_æøåÆØÅäöüÄÖÜ-]{2,32})', 'g')
  LOOP
    INSERT INTO public.post_hashtags (post_id, tag, age_band)
    VALUES (NEW.id, lower(m[1]), NEW.age_band)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_posts_hashtags ON public.posts;
CREATE TRIGGER trg_posts_hashtags
AFTER INSERT OR UPDATE OF caption, title ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_post_hashtags();

-- Backfill existing hashtags
INSERT INTO public.post_hashtags (post_id, tag, age_band)
SELECT DISTINCT p.id, lower(m[1]), p.age_band
FROM public.posts p,
LATERAL regexp_matches(coalesce(p.caption, '') || ' ' || coalesce(p.title, ''), '#([a-zA-Z0-9_æøåÆØÅäöüÄÖÜ-]{2,32})', 'g') AS m
ON CONFLICT DO NOTHING;

-- 7. Admin Super Posts
CREATE TABLE IF NOT EXISTS public.super_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  body text NOT NULL,
  media_url text,
  expires_at timestamptz,
  pinned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_posts TO authenticated;
GRANT ALL ON public.super_posts TO service_role;

ALTER TABLE public.super_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone reads active super posts"
ON public.super_posts FOR SELECT TO authenticated
USING (
  (pinned = true AND (expires_at IS NULL OR expires_at > now()))
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins insert super posts"
ON public.super_posts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update super posts"
ON public.super_posts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete super posts"
ON public.super_posts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
