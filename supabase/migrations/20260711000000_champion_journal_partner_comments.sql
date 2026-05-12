-- =====================================================================
-- 153 QUEST — 챔피언 일기 파트너 열람 + 댓글
--
-- 변경 사항:
--   1. champion_journal_comments 테이블 신설
--   2. is_journal_partner(viewer, owner) helper (코너맨 active OR 최근 30일 cheer)
--   3. champion_journal_entries SELECT RLS 에 파트너 열람 OR 조건 추가
--   4. RPC: get_partner_journal_feed, list_journal_comments, add_journal_comment
--
-- 보호 원칙:
--   · 공식 1~40 levels/missions/member_progress 일절 미수정
--   · grant_gems 직접 호출 0건 — 댓글은 보상 없음
--   · 공식 XP 변경 0건
-- =====================================================================

-- ─── 1. champion_journal_comments 테이블 ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.champion_journal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.champion_journal_entries(id) ON DELETE CASCADE,
  commenter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT champion_journal_comments_content_len CHECK (char_length(content) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_champion_journal_comments_entry_created
  ON public.champion_journal_comments (entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_champion_journal_comments_commenter_created
  ON public.champion_journal_comments (commenter_user_id, created_at DESC);

ALTER TABLE public.champion_journal_comments ENABLE ROW LEVEL SECURITY;

-- ─── 2. is_journal_partner helper ─────────────────────────────────────
-- viewer 가 owner 의 일기를 볼 자격이 있는지:
--   (a) viewer == owner (본인)
--   (b) 코너맨 active 페어 (양방향)
--   (c) 최근 30일 이내 cheer 가 양방향으로 1건 이상 (서로 응원한 사이)
CREATE OR REPLACE FUNCTION public.is_journal_partner(p_viewer uuid, p_owner uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cornerman boolean := false;
  v_cheer_a boolean := false;
  v_cheer_b boolean := false;
BEGIN
  IF p_viewer IS NULL OR p_owner IS NULL THEN
    RETURN false;
  END IF;
  IF p_viewer = p_owner THEN
    RETURN true;
  END IF;

  -- (b) 코너맨 active 페어
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_cornerman_pairs
    WHERE status = 'active'
      AND (
        (requester_user_id = p_viewer AND receiver_user_id = p_owner) OR
        (requester_user_id = p_owner AND receiver_user_id = p_viewer)
      )
  ) INTO v_cornerman;

  IF v_cornerman THEN
    RETURN true;
  END IF;

  -- (c) 최근 30일 양방향 cheer (둘 다 서로에게 응원한 적이 있어야 파트너)
  SELECT EXISTS (
    SELECT 1 FROM public.boxing_cheers
    WHERE created_at >= (now() - interval '30 days')
      AND sender_user_id = p_viewer
      AND receiver_user_id = p_owner
  ) INTO v_cheer_a;

  SELECT EXISTS (
    SELECT 1 FROM public.boxing_cheers
    WHERE created_at >= (now() - interval '30 days')
      AND sender_user_id = p_owner
      AND receiver_user_id = p_viewer
  ) INTO v_cheer_b;

  RETURN v_cheer_a AND v_cheer_b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_journal_partner(uuid, uuid) TO authenticated;

-- ─── 3. champion_journal_entries SELECT RLS 확장 ───────────────────────
DROP POLICY IF EXISTS "champion_journal_select_self_or_admin"
  ON public.champion_journal_entries;
DROP POLICY IF EXISTS "champion_journal_select_self_partner_admin"
  ON public.champion_journal_entries;
CREATE POLICY "champion_journal_select_self_partner_admin"
  ON public.champion_journal_entries FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_journal_partner(auth.uid(), user_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_branch_manager_of(auth.uid(), user_id)
  );

-- ─── 4. champion_journal_comments RLS ──────────────────────────────────
-- SELECT: entry owner / commenter / 파트너 / admin
DROP POLICY IF EXISTS "champion_journal_comments_select_party_or_admin"
  ON public.champion_journal_comments;
CREATE POLICY "champion_journal_comments_select_party_or_admin"
  ON public.champion_journal_comments FOR SELECT TO authenticated
  USING (
    commenter_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.champion_journal_entries e
      WHERE e.id = entry_id
        AND (
          e.user_id = auth.uid()
          OR public.is_journal_partner(auth.uid(), e.user_id)
        )
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- INSERT/UPDATE/DELETE 는 RPC 경로만 허용 — 직접 변경 차단.
-- (RPC 가 SECURITY DEFINER 로 우회. authenticated 에게 직접 권한 부여 X.)

-- ─── 5. RPC: get_partner_journal_feed ──────────────────────────────────
-- 내 파트너들의 최근 일기 목록 (최대 limit개)
CREATE OR REPLACE FUNCTION public.get_partner_journal_feed(p_limit integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  display_name text,
  prompt text,
  content text,
  mood text,
  created_at timestamptz,
  comment_count integer,
  relation text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer uuid := auth.uid();
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  RETURN QUERY
  WITH cornerman_partners AS (
    SELECT
      CASE WHEN requester_user_id = v_viewer THEN receiver_user_id
           ELSE requester_user_id END AS partner_id,
      'cornerman'::text AS relation
    FROM public.boxing_cornerman_pairs
    WHERE status = 'active'
      AND (requester_user_id = v_viewer OR receiver_user_id = v_viewer)
  ),
  cheer_partners AS (
    -- 양방향 cheer 인 사용자만 — A→B AND B→A
    SELECT DISTINCT c1.receiver_user_id AS partner_id, 'second'::text AS relation
    FROM public.boxing_cheers c1
    WHERE c1.sender_user_id = v_viewer
      AND c1.created_at >= (now() - interval '30 days')
      AND EXISTS (
        SELECT 1 FROM public.boxing_cheers c2
        WHERE c2.sender_user_id = c1.receiver_user_id
          AND c2.receiver_user_id = v_viewer
          AND c2.created_at >= (now() - interval '30 days')
      )
  ),
  all_partners AS (
    -- cornerman 우선 (relation 컬럼)
    SELECT partner_id, relation FROM cornerman_partners
    UNION
    SELECT cp.partner_id, cp.relation
    FROM cheer_partners cp
    WHERE NOT EXISTS (SELECT 1 FROM cornerman_partners cm WHERE cm.partner_id = cp.partner_id)
  )
  SELECT
    e.id,
    e.user_id,
    COALESCE(NULLIF(p.nickname, ''), NULLIF(p.name, ''), '익명 복서') AS display_name,
    e.prompt,
    e.content,
    e.mood,
    e.created_at,
    (SELECT COUNT(*)::integer FROM public.champion_journal_comments WHERE entry_id = e.id) AS comment_count,
    ap.relation
  FROM public.champion_journal_entries e
  JOIN all_partners ap ON ap.partner_id = e.user_id
  LEFT JOIN public.profiles p ON p.user_id = e.user_id
  ORDER BY e.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_journal_feed(integer) TO authenticated;

-- ─── 6. RPC: list_journal_comments ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_journal_comments(p_entry_id uuid)
RETURNS TABLE (
  id uuid,
  entry_id uuid,
  commenter_user_id uuid,
  commenter_name text,
  content text,
  created_at timestamptz,
  is_mine boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT user_id INTO v_owner
  FROM public.champion_journal_entries
  WHERE id = p_entry_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'entry not found';
  END IF;

  -- 본인 일기거나 파트너인 경우에만 열람
  IF NOT (v_owner = v_viewer OR public.is_journal_partner(v_viewer, v_owner)) THEN
    RAISE EXCEPTION 'not authorized to view comments for this entry';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.entry_id,
    c.commenter_user_id,
    COALESCE(NULLIF(p.nickname, ''), NULLIF(p.name, ''), '익명 복서') AS commenter_name,
    c.content,
    c.created_at,
    (c.commenter_user_id = v_viewer) AS is_mine
  FROM public.champion_journal_comments c
  LEFT JOIN public.profiles p ON p.user_id = c.commenter_user_id
  WHERE c.entry_id = p_entry_id
  ORDER BY c.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_journal_comments(uuid) TO authenticated;

-- ─── 7. RPC: add_journal_comment ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_journal_comment(
  p_entry_id uuid,
  p_content text
)
RETURNS TABLE (
  success boolean,
  comment_id uuid,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_owner uuid;
  v_clean text;
  v_id uuid;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_clean := btrim(coalesce(p_content, ''));
  IF char_length(v_clean) < 1 THEN
    RAISE EXCEPTION '댓글 내용을 입력해주세요.';
  END IF;
  IF char_length(v_clean) > 500 THEN
    RAISE EXCEPTION '댓글은 500자 이하로 작성해주세요.';
  END IF;

  SELECT user_id INTO v_owner
  FROM public.champion_journal_entries
  WHERE id = p_entry_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION '일기를 찾을 수 없습니다.';
  END IF;

  -- 본인 일기 또는 파트너만 댓글 가능
  IF NOT (v_owner = v_viewer OR public.is_journal_partner(v_viewer, v_owner)) THEN
    RAISE EXCEPTION '이 일기에는 댓글을 남길 수 없습니다. 코너맨 또는 세컨드 응원 파트너만 가능합니다.';
  END IF;

  INSERT INTO public.champion_journal_comments (entry_id, commenter_user_id, content)
  VALUES (p_entry_id, v_viewer, v_clean)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_id, '댓글이 등록되었습니다.'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_journal_comment(uuid, text) TO authenticated;

-- ─── 8. RPC: delete_journal_comment (작성자 본인만) ────────────────────
CREATE OR REPLACE FUNCTION public.delete_journal_comment(p_comment_id uuid)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_commenter uuid;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT commenter_user_id INTO v_commenter
  FROM public.champion_journal_comments
  WHERE id = p_comment_id;

  IF v_commenter IS NULL THEN
    RAISE EXCEPTION '댓글을 찾을 수 없습니다.';
  END IF;

  IF v_commenter <> v_viewer THEN
    RAISE EXCEPTION '본인 댓글만 삭제할 수 있습니다.';
  END IF;

  DELETE FROM public.champion_journal_comments WHERE id = p_comment_id;

  RETURN QUERY SELECT true, '댓글이 삭제되었습니다.'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_journal_comment(uuid) TO authenticated;
