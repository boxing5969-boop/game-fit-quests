-- ══════════════════════════════════════════════════════════════════
-- 랭킹 — 가입 직후 회원도 즉시 노출되도록 보강
--
-- 배경
--   handle_new_user() 트리거는 가입 시 member_progress + profiles +
--   user_roles(role='member') 를 자동 생성한다. 따라서 가입만 해도
--   랭킹에 잡혀야 정상.
--
--   그러나 기존 5개 랭킹 RPC 는:
--     • profiles 와 INNER JOIN — profiles 행이 일시적으로 누락되거나
--       지점 미선택 등으로 결합이 실패하면 회원 자체가 사라짐
--     • streak/boss 는 streak_days/bosses_cleared > 0 필터가 있어
--       활동 이력 없는 신규 회원이 보이지 않음 (이건 정책상 의도일 수
--       있어 유지)
--     • division 은 XP 필터 없음 — 가입만 해도 보여야 정상
--
-- 정책
--   • get_division_ranking: profiles 를 LEFT JOIN 으로 변경. 닉네임이
--     아직 없으면 user_id 의 앞 6글자를 fallback 으로 표시. 이렇게
--     하면 가입만 한 신규 회원도 빈 닉네임 상태로 일단 등장.
--   • get_weekly_activity_ranking, get_monthly_risers: xp_logs 기반
--     이라 활동 없으면 0행 — 그대로 유지 (의도된 동작).
--   • get_streak_ranking, get_boss_conquerors: 활동 지표 > 0 조건
--     유지 — 가입만 한 회원은 0 이라 등장 안 함 (의도된 동작).
--
-- 이전 마이그레이션 (20260421020000) 의 super_admin 가시성 + 전체
-- 정렬 키 (rank * 10 + level) + 신규 LEFT JOIN 을 한 번에 적용.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_division_ranking(
  _branch_name text DEFAULT NULL,
  _limit       integer DEFAULT 50
)
RETURNS TABLE (
  r_user_id        uuid,
  r_nickname       text,
  r_avatar_url     text,
  r_current_rank   rank_name,
  r_current_level  integer,
  r_bosses_cleared integer,
  r_total_xp       integer,
  r_streak_days    integer,
  rank_position    bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller_role AS (
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    ) AS is_super_admin
  ),
  effective_filter AS (
    SELECT
      CASE WHEN cr.is_super_admin THEN _branch_name
           ELSE (SELECT p.branch_name FROM profiles p WHERE p.user_id = auth.uid())
      END AS branch_filter,
      cr.is_super_admin
    FROM caller_role cr
  )
  SELECT
    mp.user_id,
    -- 가입 직후 nickname 이 비어 있을 수 있어 fallback 처리.
    COALESCE(NULLIF(p.nickname, ''), '익명' || substr(mp.user_id::text, 1, 6)) AS r_nickname,
    p.avatar_url,
    mp.current_rank,
    mp.current_level,
    mp.bosses_cleared,
    mp.total_xp,
    mp.streak_days,
    ROW_NUMBER() OVER (
      ORDER BY
        (CASE mp.current_rank
           WHEN 'white' THEN 0 WHEN 'blue' THEN 10
           WHEN 'red'   THEN 20 WHEN 'black' THEN 30
           ELSE 0
         END + COALESCE(mp.current_level, 1)) DESC,
        mp.bosses_cleared DESC,
        mp.total_xp DESC,
        mp.user_id ASC -- 동률 안정 정렬
    ) AS rank_position
  FROM member_progress mp
  LEFT JOIN profiles p ON p.user_id = mp.user_id
  CROSS JOIN effective_filter ef
  WHERE
    -- 지점 필터: 지정된 지점이면 일치해야 함. 단 신규 가입자처럼
    -- branch_name 이 NULL 이거나 빈 문자열이어도 super_admin 의
    -- 전 지점 (branch_filter=NULL) 뷰에서는 보이도록 한다.
    (
      ef.branch_filter IS NULL
      OR p.branch_name = ef.branch_filter
    )
    AND (
      ef.is_super_admin
      OR NOT EXISTS (
        SELECT 1 FROM user_roles ur
         WHERE ur.user_id = mp.user_id
           AND ur.role IN ('super_admin', 'admin', 'branch_manager')
      )
    )
  ORDER BY rank_position
  LIMIT _limit;
$$;
