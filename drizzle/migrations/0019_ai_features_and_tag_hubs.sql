ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_settings jsonb NOT NULL DEFAULT '{"enabled":true,"captions":true,"doodle":true,"tldr":true,"hubs":true,"beatSync":true}'::jsonb;

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  feature text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, feature)
);

GRANT SELECT, INSERT, UPDATE ON public.ai_usage_daily TO authenticated;
GRANT ALL ON public.ai_usage_daily TO service_role;

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai usage"
  ON public.ai_usage_daily FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own ai usage"
  ON public.ai_usage_daily FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own ai usage"
  ON public.ai_usage_daily FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.tag_hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  age_band public.age_band NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (age_band, name)
);

GRANT SELECT ON public.tag_hubs TO authenticated;
GRANT ALL ON public.tag_hubs TO service_role;

ALTER TABLE public.tag_hubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members and admins can read tag hubs"
  ON public.tag_hubs FOR SELECT TO authenticated
  USING (age_band = public.current_band() OR (select public.has_role((select auth.uid()), 'admin')));

CREATE TABLE IF NOT EXISTS public.tag_hub_members (
  hub_id uuid NOT NULL REFERENCES public.tag_hubs(id) ON DELETE CASCADE,
  tag text NOT NULL,
  PRIMARY KEY (hub_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tag_hub_members_tag ON public.tag_hub_members(tag);

GRANT SELECT ON public.tag_hub_members TO authenticated;
GRANT ALL ON public.tag_hub_members TO service_role;

ALTER TABLE public.tag_hub_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members and admins can read tag hub members"
  ON public.tag_hub_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tag_hubs h
      WHERE h.id = hub_id
        AND (h.age_band = public.current_band() OR (select public.has_role((select auth.uid()), 'admin')))
    )
  );

CREATE TABLE IF NOT EXISTS public.ai_job_state (
  job_name text PRIMARY KEY,
  locked_until timestamptz,
  paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  last_run_at timestamptz,
  last_result jsonb
);

GRANT SELECT ON public.ai_job_state TO authenticated;
GRANT ALL ON public.ai_job_state TO service_role;

ALTER TABLE public.ai_job_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ai job state"
  ON public.ai_job_state FOR SELECT TO authenticated
  USING ((select public.has_role((select auth.uid()), 'admin')));
