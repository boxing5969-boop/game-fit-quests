
-- =============================================
-- 1. ENUM TYPES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('member', 'coach', 'admin');
CREATE TYPE public.rank_name AS ENUM ('white', 'blue', 'red', 'black');
CREATE TYPE public.quest_type AS ENUM ('main', 'sub', 'weekly', 'boss');
CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');

-- =============================================
-- 2. UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- 3. ALL TABLES
-- =============================================

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  branch_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE (user_id, role)
);

CREATE TABLE public.coach_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, member_id)
);

CREATE TABLE public.member_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_rank rank_name NOT NULL DEFAULT 'white',
  current_level INT NOT NULL DEFAULT 1,
  total_xp INT NOT NULL DEFAULT 0,
  streak_days INT NOT NULL DEFAULT 0,
  bosses_cleared INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rank_name rank_name NOT NULL,
  level_number INT NOT NULL,
  title TEXT NOT NULL,
  xp_required INT NOT NULL DEFAULT 0,
  is_boss BOOLEAN NOT NULL DEFAULT false,
  reward_name TEXT,
  display_order INT NOT NULL DEFAULT 0,
  UNIQUE (rank_name, level_number)
);

CREATE TABLE public.quests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL,
  quest_type quest_type NOT NULL DEFAULT 'main',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  xp_reward INT NOT NULL DEFAULT 0,
  needs_coach_approval BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.quest_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quest_id UUID REFERENCES public.quests(id) ON DELETE CASCADE NOT NULL,
  status submission_status NOT NULL DEFAULT 'pending',
  coach_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.xp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT
);

CREATE TABLE public.member_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

-- =============================================
-- 4. INDEXES
-- =============================================
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_coach_assignments_coach ON public.coach_assignments(coach_id);
CREATE INDEX idx_coach_assignments_member ON public.coach_assignments(member_id);
CREATE INDEX idx_quest_submissions_user ON public.quest_submissions(user_id);
CREATE INDEX idx_quest_submissions_status ON public.quest_submissions(status);
CREATE INDEX idx_xp_logs_user ON public.xp_logs(user_id);
CREATE INDEX idx_member_badges_user ON public.member_badges(user_id);
CREATE INDEX idx_levels_rank ON public.levels(rank_name, level_number);

-- =============================================
-- 5. TRIGGERS
-- =============================================
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_progress_updated_at
  BEFORE UPDATE ON public.member_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 6. SECURITY DEFINER FUNCTIONS (tables exist now)
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_coach_of(_coach_id uuid, _member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_assignments
    WHERE coach_id = _coach_id AND member_id = _member_id
  )
$$;

-- =============================================
-- 7. AUTO-CREATE PROFILE + ROLE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.raw_user_meta_data->>'nickname', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  INSERT INTO public.member_progress (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 8. ENABLE RLS
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_badges ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 9. RLS POLICIES
-- =============================================

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- coach_assignments
CREATE POLICY "Coaches view own assignments" ON public.coach_assignments FOR SELECT TO authenticated USING (auth.uid() = coach_id);
CREATE POLICY "Members see their coach" ON public.coach_assignments FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY "Admins manage assignments" ON public.coach_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- member_progress
CREATE POLICY "Users view own progress" ON public.member_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned progress" ON public.member_progress FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));
CREATE POLICY "Admins view all progress" ON public.member_progress FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own progress" ON public.member_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins update all progress" ON public.member_progress FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- levels
CREATE POLICY "All view levels" ON public.levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage levels" ON public.levels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- quests
CREATE POLICY "All view quests" ON public.quests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage quests" ON public.quests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- quest_submissions
CREATE POLICY "Users view own submissions" ON public.quest_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own submissions" ON public.quest_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned submissions" ON public.quest_submissions FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));
CREATE POLICY "Coaches update assigned submissions" ON public.quest_submissions FOR UPDATE TO authenticated USING (public.is_coach_of(auth.uid(), user_id));
CREATE POLICY "Admins manage all submissions" ON public.quest_submissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- xp_logs
CREATE POLICY "Users view own xp" ON public.xp_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned xp" ON public.xp_logs FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));
CREATE POLICY "Admins manage xp" ON public.xp_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- badges
CREATE POLICY "All view badges" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage badges" ON public.badges FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- member_badges
CREATE POLICY "Users view own badges" ON public.member_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned badges" ON public.member_badges FOR SELECT TO authenticated USING (public.is_coach_of(auth.uid(), user_id));
CREATE POLICY "Admins manage member badges" ON public.member_badges FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
