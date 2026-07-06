-- ============================================================
-- 성능 정비 1/2 — Supabase advisor 대응 (2026-07-05 운영DB 적용됨)
-- 1) RLS 정책의 auth.uid()/auth.role()/auth.jwt() 를 (select ...) 로 래핑
--    → 행마다 재평가되던 것을 쿼리당 1회(InitPlan)로. 동작 완전 동일. (202건)
-- 2) 커버 인덱스 없는 FK 35건 인덱스 추가
-- 3) search_path 미고정 함수 9건 고정 (mutable search_path 경고 해소)
-- ============================================================

-- 1) RLS initplan 래핑 (이미 래핑된 표현식은 보호 후 복원 → 멱등)
DO $do$
DECLARE
  p record;
  new_qual text;
  new_check text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual,'') ~ 'auth\.(uid|role|jwt)\(\)'
           OR coalesce(with_check,'') ~ 'auth\.(uid|role|jwt)\(\)')
  LOOP
    new_qual := p.qual;
    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, 'SELECT auth.uid()',  'SELECT __KEEPUID__');
      new_qual := replace(new_qual, 'SELECT auth.role()', 'SELECT __KEEPROLE__');
      new_qual := replace(new_qual, 'SELECT auth.jwt()',  'SELECT __KEEPJWT__');
      new_qual := replace(new_qual, 'auth.uid()',  '(select auth.uid())');
      new_qual := replace(new_qual, 'auth.role()', '(select auth.role())');
      new_qual := replace(new_qual, 'auth.jwt()',  '(select auth.jwt())');
      new_qual := replace(new_qual, 'SELECT __KEEPUID__',  'SELECT auth.uid()');
      new_qual := replace(new_qual, 'SELECT __KEEPROLE__', 'SELECT auth.role()');
      new_qual := replace(new_qual, 'SELECT __KEEPJWT__',  'SELECT auth.jwt()');
    END IF;

    new_check := p.with_check;
    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, 'SELECT auth.uid()',  'SELECT __KEEPUID__');
      new_check := replace(new_check, 'SELECT auth.role()', 'SELECT __KEEPROLE__');
      new_check := replace(new_check, 'SELECT auth.jwt()',  'SELECT __KEEPJWT__');
      new_check := replace(new_check, 'auth.uid()',  '(select auth.uid())');
      new_check := replace(new_check, 'auth.role()', '(select auth.role())');
      new_check := replace(new_check, 'auth.jwt()',  '(select auth.jwt())');
      new_check := replace(new_check, 'SELECT __KEEPUID__',  'SELECT auth.uid()');
      new_check := replace(new_check, 'SELECT __KEEPROLE__', 'SELECT auth.role()');
      new_check := replace(new_check, 'SELECT __KEEPJWT__',  'SELECT auth.jwt()');
    END IF;

    IF (new_qual IS DISTINCT FROM p.qual) OR (new_check IS DISTINCT FROM p.with_check) THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I%s%s',
        p.policyname, p.schemaname, p.tablename,
        CASE WHEN new_qual  IS NOT NULL THEN ' USING ('      || new_qual  || ')' ELSE '' END,
        CASE WHEN new_check IS NOT NULL THEN ' WITH CHECK (' || new_check || ')' ELSE '' END
      );
    END IF;
  END LOOP;
END
$do$;

-- 2) FK 커버 인덱스 35건
CREATE INDEX IF NOT EXISTS idx_avatar_items_category_code ON avatar_items (category_code);
CREATE INDEX IF NOT EXISTS idx_boxing_fun_challenge_attempts_challenge_id ON boxing_fun_challenge_attempts (challenge_id);
CREATE INDEX IF NOT EXISTS idx_boxing_hidden_mission_claims_mission_id ON boxing_hidden_mission_claims (mission_id);
CREATE INDEX IF NOT EXISTS idx_boxing_quiz_attempts_question_id ON boxing_quiz_attempts (question_id);
CREATE INDEX IF NOT EXISTS idx_boxing_story_ending_claims_route_id ON boxing_story_ending_claims (route_id);
CREATE INDEX IF NOT EXISTS idx_boxing_story_inventory_card_code ON boxing_story_inventory (card_code);
CREATE INDEX IF NOT EXISTS idx_boxing_story_reward_claims_route_id ON boxing_story_reward_claims (route_id);
CREATE INDEX IF NOT EXISTS idx_boxing_story_reward_claims_chapter_id ON boxing_story_reward_claims (chapter_id);
CREATE INDEX IF NOT EXISTS idx_boxing_user_scene_progress_route_id ON boxing_user_scene_progress (route_id);
CREATE INDEX IF NOT EXISTS idx_boxing_user_scene_progress_chapter_id ON boxing_user_scene_progress (chapter_id);
CREATE INDEX IF NOT EXISTS idx_boxing_user_story_progress_current_chapter_id ON boxing_user_story_progress (current_chapter_id);
CREATE INDEX IF NOT EXISTS idx_boxing_user_story_progress_route_id ON boxing_user_story_progress (route_id);
CREATE INDEX IF NOT EXISTS idx_boxing_user_story_route_state_active_route_id ON boxing_user_story_route_state (active_route_id);
CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON challenges (created_by);
CREATE INDEX IF NOT EXISTS idx_diet_coach_notes_enrollment_id ON diet_coach_notes (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_diet_coach_notes_author_id ON diet_coach_notes (author_id);
CREATE INDEX IF NOT EXISTS idx_diet_coach_notes_related_log_id ON diet_coach_notes (related_log_id);
CREATE INDEX IF NOT EXISTS idx_diet_daily_logs_reviewed_by ON diet_daily_logs (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_diet_post_program_plans_coach_recommended_by ON diet_post_program_plans (coach_recommended_by);
CREATE INDEX IF NOT EXISTS idx_diet_program_enrollments_screening_id ON diet_program_enrollments (screening_id);
CREATE INDEX IF NOT EXISTS idx_member_badges_badge_id ON member_badges (badge_id);
CREATE INDEX IF NOT EXISTS idx_member_character_assignments_preset_id ON member_character_assignments (preset_id);
CREATE INDEX IF NOT EXISTS idx_membership_requests_user_id ON membership_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_mission_submissions_mission_id ON mission_submissions (mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_videos_mission_id ON mission_videos (mission_id);
CREATE INDEX IF NOT EXISTS idx_missions_level_id ON missions (level_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_product_id ON payment_orders (product_id);
CREATE INDEX IF NOT EXISTS idx_quest_submissions_reviewed_by ON quest_submissions (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_quest_submissions_quest_id ON quest_submissions (quest_id);
CREATE INDEX IF NOT EXISTS idx_quests_level_id ON quests (level_id);
CREATE INDEX IF NOT EXISTS idx_session_templates_updated_by ON session_templates (updated_by);
CREATE INDEX IF NOT EXISTS idx_tutorial_global_overrides_updated_by ON tutorial_global_overrides (updated_by);
CREATE INDEX IF NOT EXISTS idx_user_avatar_equipment_category_code ON user_avatar_equipment (category_code);
CREATE INDEX IF NOT EXISTS idx_user_avatar_equipment_item_id ON user_avatar_equipment (item_id);
CREATE INDEX IF NOT EXISTS idx_user_owned_items_item_id ON user_owned_items (item_id);

-- 3) search_path 고정 (mutable 경고 9건)
ALTER FUNCTION _story_clamp_int(integer,integer,integer) SET search_path TO 'public';
ALTER FUNCTION boxing_engagement_set_updated_at() SET search_path TO 'public';
ALTER FUNCTION boxing_return_type_for_days(integer) SET search_path TO 'public';
ALTER FUNCTION boxing_story_route_state_set_updated_at() SET search_path TO 'public';
ALTER FUNCTION diet_enforce_track_rules() SET search_path TO 'public';
ALTER FUNCTION diet_touch_log_updated_at() SET search_path TO 'public';
ALTER FUNCTION get_customization_required_level(text,text) SET search_path TO 'public';
ALTER FUNCTION is_hof_required_item(text,text) SET search_path TO 'public';
ALTER FUNCTION tutorial_step_reward_amount(integer) SET search_path TO 'public';
