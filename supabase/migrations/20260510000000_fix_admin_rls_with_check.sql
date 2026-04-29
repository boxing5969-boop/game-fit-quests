-- ============================================================
-- 153 — Admin RLS 정책 super_admin 전환 + WITH CHECK 보수
-- ============================================================
-- 배경:
--   초기 마이그레이션 시점에 정의된 "Admins manage X" 정책들이
--   `has_role(auth.uid(), 'admin')` 만 체크함. 이후 20260408175055 가
--   app_role enum 을 확장하고 모든 'admin' user_roles 데이터를
--   'super_admin' 으로 변경 → 현재 운영에 'admin' role 보유자 0명 →
--   기존 정책 자체가 항상 false 반환 → admin 작업 전부 deny.
--
--   추가로 "Admins manage X FOR ALL USING (...)" 형태는 WITH CHECK 가
--   비어 있어 INSERT 시 PostgreSQL 이 자동 거부.
--
--   증상:
--     · MissionManager 미션 추가 → "new row violates row-level
--       security policy for table missions"
--     · mission-videos 버킷 영상/포스터 업로드 실패
--     · levels/badges/member_badges 관리도 동일
--
-- 보호 원칙(절대):
--   · 본 migration 은 테이블/스토리지 데이터·구조를 일절 수정하지 않는다.
--   · 회원/코치/지점장 정책은 손대지 않는다 — super_admin 정책만 보수.
--   · 기존 정책 의도 유지: super_admin = 전체 콘텐츠 관리 권한.
--
-- 적용 범위:
--   · public.missions
--   · public.mission_videos
--   · public.levels
--   · public.badges
--   · public.member_badges
--   · public.mission_submissions  ("Admins manage all submissions")
--   · public.quest_submissions    ("Admins manage all submissions")
--   · storage.objects (mission-videos 버킷 INSERT/UPDATE/DELETE)
-- ============================================================

-- ─── public.missions ─────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage missions" ON public.missions;
CREATE POLICY "Super admins manage missions"
  ON public.missions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ─── public.mission_videos ───────────────────────────────────
DROP POLICY IF EXISTS "Admins manage videos" ON public.mission_videos;
CREATE POLICY "Super admins manage videos"
  ON public.mission_videos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ─── public.levels ───────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage levels" ON public.levels;
CREATE POLICY "Super admins manage levels"
  ON public.levels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ─── public.badges ───────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage badges" ON public.badges;
CREATE POLICY "Super admins manage badges"
  ON public.badges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ─── public.member_badges ────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage member badges" ON public.member_badges;
CREATE POLICY "Super admins manage member badges"
  ON public.member_badges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ─── public.mission_submissions ──────────────────────────────
DROP POLICY IF EXISTS "Admins manage all submissions" ON public.mission_submissions;
CREATE POLICY "Super admins manage all mission submissions"
  ON public.mission_submissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ─── public.quest_submissions ────────────────────────────────
DROP POLICY IF EXISTS "Admins manage all submissions" ON public.quest_submissions;
CREATE POLICY "Super admins manage all quest submissions"
  ON public.quest_submissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ─── storage.objects (mission-videos 버킷) ───────────────────
-- 버킷 자체는 public 읽기 정책 유지. INSERT/UPDATE/DELETE 만 super_admin.
DROP POLICY IF EXISTS "Admins can upload mission videos" ON storage.objects;
CREATE POLICY "Super admins can upload mission videos"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mission-videos'
    AND public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "Admins can update mission videos" ON storage.objects;
CREATE POLICY "Super admins can update mission videos"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mission-videos'
    AND public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    bucket_id = 'mission-videos'
    AND public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "Admins can delete mission videos" ON storage.objects;
CREATE POLICY "Super admins can delete mission videos"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mission-videos'
    AND public.has_role(auth.uid(), 'super_admin')
  );

-- 자체 검증 (super_admin 세션):
--   1. INSERT INTO missions (level_id, title, description, difficulty, xp_reward)
--      VALUES ('<level-id>', '테스트', '...', 1, 10);  → 성공
--   2. INSERT INTO mission_videos (mission_id, video_url) VALUES (..., ...);  → 성공
--   3. (storage) supabase.storage.from('mission-videos').upload('posters/test.jpg', file)
--      → 성공
--   4. (회원 세션) 동일 INSERT → 거부 (USING/WITH CHECK 모두 false)
--   5. SELECT 흐름은 무영향 ("All view missions FOR SELECT USING (true)" 그대로).
