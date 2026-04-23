-- =========================================================================
-- 153 다이어트 · 21일 챌린지 (커뮤니티 MVP)
--
-- 철학: 체중 경쟁이 아니라 "같이 21일 하는 프로젝트".
--   · 점수 = 출석·미션·복귀·연속 참여 기반 (몸무게 kg 직접 비교 금지)
--   · 팀전 (레드 vs 블루 등) · 목표별 그룹 (감량·야식끊기·운동습관·유지)
--   · 초대 코드로 외부 친구 참여 가능
--   · 꾸준함 = 점수. 상위권만 보상받지 않도록 완주 참여자 전원 인정.
-- =========================================================================

-- 1. Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challenge_goal') THEN
    CREATE TYPE public.challenge_goal AS ENUM (
      'fat_loss',        -- 체지방 감량형
      'late_snack_stop', -- 야식 끊기형
      'workout_habit',   -- 운동 습관형
      'maintenance'      -- 유지 관리형
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challenge_status') THEN
    CREATE TYPE public.challenge_status AS ENUM (
      'upcoming',  -- 시작 전
      'active',    -- 진행 중
      'ended'      -- 종료
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challenge_team_side') THEN
    CREATE TYPE public.challenge_team_side AS ENUM ('red','blue','none');
  END IF;
END$$;

-- 2. challenges — 챌린지 본체
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  goal public.challenge_goal NOT NULL,
  branch_name text,               -- NULL = 전체 공개, 있으면 지점 한정
  start_date date NOT NULL,
  duration_days int NOT NULL DEFAULT 21 CHECK (duration_days BETWEEN 7 AND 30),
  status public.challenge_status NOT NULL DEFAULT 'upcoming',
  invite_code text UNIQUE,        -- 공유 코드 (소문자 영숫자 6~8자)
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS challenges_status_idx ON public.challenges(status);
CREATE INDEX IF NOT EXISTS challenges_branch_idx ON public.challenges(branch_name) WHERE branch_name IS NOT NULL;

-- 3. challenge_participants — 참여자
CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_side public.challenge_team_side NOT NULL DEFAULT 'none',
  joined_at timestamptz NOT NULL DEFAULT now(),
  total_points int NOT NULL DEFAULT 0,
  last_checkin_date date,
  current_streak int NOT NULL DEFAULT 0,
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS challenge_participants_user_idx
  ON public.challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS challenge_participants_leaderboard_idx
  ON public.challenge_participants(challenge_id, total_points DESC);

-- 4. challenge_checkins — 일일 체크인 이벤트
CREATE TABLE IF NOT EXISTS public.challenge_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.challenge_participants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  points int NOT NULL DEFAULT 1 CHECK (points BETWEEN 0 AND 20),
  kind text NOT NULL DEFAULT 'daily',  -- daily | comeback | mission | photo
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, checkin_date, kind)  -- 같은 날 같은 종류 중복 방지
);

CREATE INDEX IF NOT EXISTS challenge_checkins_user_date_idx
  ON public.challenge_checkins(user_id, checkin_date DESC);

-- 5. RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_read_all" ON public.challenges;
CREATE POLICY "challenges_read_all"
  ON public.challenges FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "challenge_participants_read" ON public.challenge_participants;
CREATE POLICY "challenge_participants_read"
  ON public.challenge_participants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "challenge_checkins_read_own" ON public.challenge_checkins;
CREATE POLICY "challenge_checkins_read_own"
  ON public.challenge_checkins FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_branch_manager_of(auth.uid(), user_id)
    OR public.has_role(auth.uid(),'super_admin')
  );

-- 6. RPC — join_challenge
CREATE OR REPLACE FUNCTION public.join_challenge(
  _challenge_id uuid,
  _team_side public.challenge_team_side DEFAULT 'none',
  _invite_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ch public.challenges%ROWTYPE;
  _pid uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _ch FROM public.challenges WHERE id = _challenge_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'challenge_not_found');
  END IF;

  -- 초대 코드 검증 (invite_code 있는 챌린지면 일치 필수)
  IF _ch.invite_code IS NOT NULL
     AND (_invite_code IS NULL OR LOWER(_invite_code) <> _ch.invite_code) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_invite_code');
  END IF;

  INSERT INTO public.challenge_participants (challenge_id, user_id, team_side)
  VALUES (_challenge_id, _uid, _team_side)
  ON CONFLICT (challenge_id, user_id) DO UPDATE SET team_side = EXCLUDED.team_side
  RETURNING id INTO _pid;

  RETURN jsonb_build_object('success', true, 'participant_id', _pid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_challenge(
  uuid, public.challenge_team_side, text
) TO authenticated;

-- 7. RPC — submit_challenge_checkin
CREATE OR REPLACE FUNCTION public.submit_challenge_checkin(
  _challenge_id uuid,
  _kind text DEFAULT 'daily',
  _points int DEFAULT 1,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
  _today date := CURRENT_DATE;
  _last_date date;
  _streak int;
  _inserted uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, last_checkin_date, current_streak
  INTO _pid, _last_date, _streak
  FROM public.challenge_participants
  WHERE challenge_id = _challenge_id AND user_id = _uid;
  IF _pid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_participant');
  END IF;

  -- 체크인 저장 (UNIQUE 제약으로 같은 날 동일 종류 중복은 조용히 무시)
  BEGIN
    INSERT INTO public.challenge_checkins (
      participant_id, user_id, checkin_date, points, kind, note
    ) VALUES (
      _pid, _uid, _today, GREATEST(0, LEAST(20, COALESCE(_points, 1))), COALESCE(_kind,'daily'), _note
    )
    RETURNING id INTO _inserted;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'already_done_today', true);
  END;

  -- streak 갱신 — 어제면 +1, 오늘 첫 체크인이면 유지 또는 리셋
  IF _last_date IS NULL OR _last_date < _today - 1 THEN
    _streak := 1;
  ELSIF _last_date = _today - 1 THEN
    _streak := _streak + 1;
  END IF;

  UPDATE public.challenge_participants SET
    total_points = total_points + GREATEST(0, LEAST(20, COALESCE(_points, 1))),
    last_checkin_date = _today,
    current_streak = _streak
  WHERE id = _pid;

  RETURN jsonb_build_object(
    'success', true,
    'checkin_id', _inserted,
    'current_streak', _streak
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_challenge_checkin(uuid, text, int, text) TO authenticated;

-- 8. RPC — get_challenge_leaderboard (팀/개인 현황 요약)
CREATE OR REPLACE FUNCTION public.get_challenge_leaderboard(
  _challenge_id uuid,
  _limit int DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _team_red int := 0;
  _team_blue int := 0;
  _participant_count int;
  _top jsonb;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN team_side='red' THEN total_points ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN team_side='blue' THEN total_points ELSE 0 END), 0),
         COUNT(*)
  INTO _team_red, _team_blue, _participant_count
  FROM public.challenge_participants
  WHERE challenge_id = _challenge_id;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.total_points DESC, r.current_streak DESC), '[]'::jsonb)
  INTO _top
  FROM (
    SELECT
      cp.user_id,
      cp.team_side,
      cp.total_points,
      cp.current_streak,
      cp.last_checkin_date,
      p.name AS member_name,
      p.branch_name
    FROM public.challenge_participants cp
    LEFT JOIN public.profiles p ON p.user_id = cp.user_id
    WHERE cp.challenge_id = _challenge_id
    ORDER BY cp.total_points DESC, cp.current_streak DESC
    LIMIT LEAST(GREATEST(_limit, 1), 100)
  ) r;

  RETURN jsonb_build_object(
    'success', true,
    'team_red_points', _team_red,
    'team_blue_points', _team_blue,
    'participant_count', _participant_count,
    'rows', _top
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard(uuid, int) TO authenticated;

-- 9. RPC — list_challenges (공개 + 내 참여)
CREATE OR REPLACE FUNCTION public.list_challenges(
  _status public.challenge_status DEFAULT NULL,
  _branch_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.start_date DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      c.id,
      c.title,
      c.goal,
      c.branch_name,
      c.start_date,
      c.duration_days,
      c.status,
      c.invite_code,
      EXISTS (
        SELECT 1 FROM public.challenge_participants cp
        WHERE cp.challenge_id = c.id AND cp.user_id = _uid
      ) AS is_joined,
      (SELECT COUNT(*) FROM public.challenge_participants WHERE challenge_id = c.id) AS participant_count
    FROM public.challenges c
    WHERE (_status IS NULL OR c.status = _status)
      AND (_branch_name IS NULL OR c.branch_name = _branch_name OR c.branch_name IS NULL)
  ) r;

  RETURN jsonb_build_object('success', true, 'rows', _rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_challenges(
  public.challenge_status, text
) TO authenticated;

COMMENT ON TABLE public.challenges IS
  '21일 챌린지 — 체중 경쟁 아닌 출석·미션·연속 참여 기반 커뮤니티.';
