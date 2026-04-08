
-- Missions table (one per level)
CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid REFERENCES public.levels(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  difficulty integer NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  xp_reward integer NOT NULL DEFAULT 20,
  key_point_1 text NOT NULL DEFAULT '',
  key_point_2 text NOT NULL DEFAULT '',
  key_point_3 text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All view missions" ON public.missions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage missions" ON public.missions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Mission videos table
CREATE TABLE public.mission_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  source_type text NOT NULL DEFAULT 'external_url' CHECK (source_type IN ('external_url', 'storage')),
  video_url text NOT NULL,
  poster_url text,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All view videos" ON public.mission_videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage videos" ON public.mission_videos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Mission submissions (replaces quest_submissions for mission flow)
CREATE TABLE public.mission_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  coach_note text,
  reviewed_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.mission_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own submissions" ON public.mission_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own submissions" ON public.mission_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned submissions" ON public.mission_submissions FOR SELECT TO authenticated USING (is_coach_of(auth.uid(), user_id));
CREATE POLICY "Coaches update assigned submissions" ON public.mission_submissions FOR UPDATE TO authenticated USING (is_coach_of(auth.uid(), user_id));
CREATE POLICY "Admins manage all submissions" ON public.mission_submissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Hidden mastery (coach/admin only)
CREATE TABLE public.hidden_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  technique_score integer NOT NULL DEFAULT 0 CHECK (technique_score BETWEEN 0 AND 100),
  conditioning_score integer NOT NULL DEFAULT 0 CHECK (conditioning_score BETWEEN 0 AND 100),
  teaching_score integer NOT NULL DEFAULT 0 CHECK (teaching_score BETWEEN 0 AND 100),
  safety_score integer NOT NULL DEFAULT 0 CHECK (safety_score BETWEEN 0 AND 100),
  evaluation_score integer NOT NULL DEFAULT 0 CHECK (evaluation_score BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hidden_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches view assigned mastery" ON public.hidden_mastery FOR SELECT TO authenticated USING (is_coach_of(auth.uid(), user_id));
CREATE POLICY "Coaches update assigned mastery" ON public.hidden_mastery FOR UPDATE TO authenticated USING (is_coach_of(auth.uid(), user_id));
CREATE POLICY "Admins manage all mastery" ON public.hidden_mastery FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- External cert progress (coach/admin only)
CREATE TABLE public.external_cert_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  dan4_ready boolean NOT NULL DEFAULT false,
  examiner_ready boolean NOT NULL DEFAULT false,
  coach_cert_ready boolean NOT NULL DEFAULT false,
  age_gate boolean NOT NULL DEFAULT false,
  coach_approval boolean NOT NULL DEFAULT false,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_cert_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches view assigned cert" ON public.external_cert_progress FOR SELECT TO authenticated USING (is_coach_of(auth.uid(), user_id));
CREATE POLICY "Coaches update assigned cert" ON public.external_cert_progress FOR UPDATE TO authenticated USING (is_coach_of(auth.uid(), user_id));
CREATE POLICY "Admins manage all cert" ON public.external_cert_progress FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Auto-create hidden_mastery and cert_progress on new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.raw_user_meta_data->>'nickname', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  INSERT INTO public.member_progress (user_id) VALUES (NEW.id);
  INSERT INTO public.hidden_mastery (user_id) VALUES (NEW.id);
  INSERT INTO public.external_cert_progress (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Approve mission submission function
CREATE OR REPLACE FUNCTION public.approve_mission_submission(_submission_id uuid, _coach_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _sub record;
  _mission record;
  _progress record;
  _level record;
  _xp_amount int;
  _leveled_up boolean := false;
  _ranked_up boolean := false;
  _new_level int;
  _new_rank rank_name;
  _caller_id uuid := auth.uid();
BEGIN
  SELECT * INTO _sub FROM mission_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _sub.status != 'pending' THEN RAISE EXCEPTION 'Not pending'; END IF;

  IF NOT (has_role(_caller_id, 'admin') OR is_coach_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _mission FROM missions WHERE id = _sub.mission_id;
  _xp_amount := _mission.xp_reward;

  UPDATE mission_submissions
  SET status = 'approved', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id
  WHERE id = _submission_id;

  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_sub.user_id, _xp_amount, _mission.title || ' 클리어');

  UPDATE member_progress
  SET total_xp = total_xp + _xp_amount
  WHERE user_id = _sub.user_id;

  SELECT * INTO _progress FROM member_progress WHERE user_id = _sub.user_id;

  SELECT * INTO _level FROM levels
  WHERE rank_name = _progress.current_rank AND level_number = _progress.current_level;

  IF _level IS NOT NULL AND _progress.total_xp >= _level.xp_required THEN
    IF _progress.current_level < 10 THEN
      _new_level := _progress.current_level + 1;
      _new_rank := _progress.current_rank;
      _leveled_up := true;
      UPDATE member_progress SET current_level = _new_level WHERE user_id = _sub.user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'xp_granted', _xp_amount,
    'leveled_up', _leveled_up,
    'ranked_up', _ranked_up,
    'new_level', COALESCE(_new_level, _progress.current_level),
    'new_rank', COALESCE(_new_rank, _progress.current_rank)::text,
    'total_xp', _progress.total_xp + _xp_amount
  );
END;
$$;

-- Reject mission submission function
CREATE OR REPLACE FUNCTION public.reject_mission_submission(_submission_id uuid, _coach_note text DEFAULT '다시 도전해보세요')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _sub record;
  _caller_id uuid := auth.uid();
BEGIN
  SELECT * INTO _sub FROM mission_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;

  IF NOT (has_role(_caller_id, 'admin') OR is_coach_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE mission_submissions
  SET status = 'rejected', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id
  WHERE id = _submission_id;
END;
$$;
