
-- =============================================
-- 1. avatar_item_categories
-- =============================================
CREATE TABLE public.avatar_item_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avatar_item_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view categories"
  ON public.avatar_item_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage categories"
  ON public.avatar_item_categories FOR ALL
  TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- =============================================
-- 2. avatar_items
-- =============================================
CREATE TABLE public.avatar_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_code text NOT NULL REFERENCES public.avatar_item_categories(code),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  rarity text NOT NULL DEFAULT 'common',
  price_gems integer NOT NULL DEFAULT 0,
  asset_url text,
  thumb_url text,
  league_requirement text DEFAULT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avatar_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view items"
  ON public.avatar_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage items"
  ON public.avatar_items FOR ALL
  TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- =============================================
-- 3. user_wallets
-- =============================================
CREATE TABLE public.user_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  gems_balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet"
  ON public.user_wallets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own wallet"
  ON public.user_wallets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Branch managers view same branch wallets"
  ON public.user_wallets FOR SELECT
  TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Super admins manage all wallets"
  ON public.user_wallets FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

-- =============================================
-- 4. wallet_transactions
-- =============================================
CREATE TABLE public.wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL DEFAULT '',
  meta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Branch managers view same branch transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated USING (is_same_branch(user_id));

CREATE POLICY "Super admins manage all transactions"
  ON public.wallet_transactions FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

-- =============================================
-- 5. user_owned_items
-- =============================================
CREATE TABLE public.user_owned_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.avatar_items(id),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

ALTER TABLE public.user_owned_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own items"
  ON public.user_owned_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Super admins manage all owned items"
  ON public.user_owned_items FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

-- =============================================
-- 6. user_avatar_equipment
-- =============================================
CREATE TABLE public.user_avatar_equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  category_code text NOT NULL REFERENCES public.avatar_item_categories(code),
  item_id uuid NOT NULL REFERENCES public.avatar_items(id),
  equipped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_code)
);

ALTER TABLE public.user_avatar_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own equipment"
  ON public.user_avatar_equipment FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users manage own equipment"
  ON public.user_avatar_equipment FOR ALL
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Anon view equipment for live board"
  ON public.user_avatar_equipment FOR SELECT
  TO anon USING (true);

CREATE POLICY "Super admins manage all equipment"
  ON public.user_avatar_equipment FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

-- =============================================
-- 7. grant_gems function
-- =============================================
CREATE OR REPLACE FUNCTION public.grant_gems(_user_id uuid, _amount integer, _reason text DEFAULT '링젬 지급')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update wallet balance
  UPDATE user_wallets
  SET gems_balance = gems_balance + _amount,
      total_earned = CASE WHEN _amount > 0 THEN total_earned + _amount ELSE total_earned END,
      total_spent = CASE WHEN _amount < 0 THEN total_spent + ABS(_amount) ELSE total_spent END,
      updated_at = now()
  WHERE user_id = _user_id;

  -- If no wallet exists, create one
  IF NOT FOUND THEN
    INSERT INTO user_wallets (user_id, gems_balance, total_earned, total_spent)
    VALUES (_user_id, GREATEST(_amount, 0),
            CASE WHEN _amount > 0 THEN _amount ELSE 0 END,
            CASE WHEN _amount < 0 THEN ABS(_amount) ELSE 0 END);
  END IF;

  -- Record transaction
  INSERT INTO wallet_transactions (user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

-- =============================================
-- 8. purchase_avatar_item function
-- =============================================
CREATE OR REPLACE FUNCTION public.purchase_avatar_item(_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _item record;
  _wallet record;
BEGIN
  SELECT * INTO _item FROM avatar_items WHERE id = _item_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION '아이템을 찾을 수 없습니다'; END IF;

  -- Check if already owned
  IF EXISTS (SELECT 1 FROM user_owned_items WHERE user_id = _caller_id AND item_id = _item_id) THEN
    RAISE EXCEPTION '이미 소유한 아이템입니다';
  END IF;

  -- Check league requirement
  IF _item.league_requirement IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM member_progress
      WHERE user_id = _caller_id
        AND rank_order(current_rank) >= rank_order(_item.league_requirement::rank_name)
    ) THEN
      RAISE EXCEPTION '리그 조건을 충족하지 않습니다';
    END IF;
  END IF;

  -- Check balance
  SELECT * INTO _wallet FROM user_wallets WHERE user_id = _caller_id;
  IF _wallet IS NULL OR _wallet.gems_balance < _item.price_gems THEN
    RAISE EXCEPTION '링젬이 부족합니다';
  END IF;

  -- Deduct gems
  PERFORM grant_gems(_caller_id, -_item.price_gems, _item.name || ' 구매');

  -- Add to owned
  INSERT INTO user_owned_items (user_id, item_id) VALUES (_caller_id, _item_id);

  RETURN jsonb_build_object(
    'success', true,
    'item_name', _item.name,
    'price', _item.price_gems,
    'remaining_gems', _wallet.gems_balance - _item.price_gems
  );
END;
$$;

-- =============================================
-- 9. equip_avatar_item function
-- =============================================
CREATE OR REPLACE FUNCTION public.equip_avatar_item(_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _item record;
BEGIN
  SELECT * INTO _item FROM avatar_items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;

  -- Must own the item
  IF NOT EXISTS (SELECT 1 FROM user_owned_items WHERE user_id = _caller_id AND item_id = _item_id) THEN
    RAISE EXCEPTION '소유하지 않은 아이템입니다';
  END IF;

  -- Upsert equipment
  INSERT INTO user_avatar_equipment (user_id, category_code, item_id)
  VALUES (_caller_id, _item.category_code, _item_id)
  ON CONFLICT (user_id, category_code)
  DO UPDATE SET item_id = _item_id, equipped_at = now();
END;
$$;

-- =============================================
-- 10. unequip_avatar_item function
-- =============================================
CREATE OR REPLACE FUNCTION public.unequip_avatar_item(_category_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM user_avatar_equipment
  WHERE user_id = auth.uid() AND category_code = _category_code;
END;
$$;

-- =============================================
-- 11. Update handle_new_user to create wallet
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, nickname, phone_number, branch_name, birth_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
    COALESCE(NEW.raw_user_meta_data->>'branch_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'birth_date', NULL)
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  INSERT INTO public.member_progress (user_id) VALUES (NEW.id);
  INSERT INTO public.hidden_mastery (user_id) VALUES (NEW.id);
  INSERT INTO public.external_cert_progress (user_id) VALUES (NEW.id);
  INSERT INTO public.user_wallets (user_id, gems_balance) VALUES (NEW.id, 0);

  IF COALESCE((NEW.raw_user_meta_data->>'is_coach_request')::boolean, false) THEN
    INSERT INTO public.coach_requests (user_id, status) VALUES (NEW.id, 'pending');
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- 12. Update existing functions to grant gems
-- =============================================

-- approve_mission_submission: +5 gems
CREATE OR REPLACE FUNCTION public.approve_mission_submission(_submission_id uuid, _coach_note text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub record; _mission record; _progress record; _level record;
  _xp_amount int; _leveled_up boolean := false; _ranked_up boolean := false;
  _new_level int; _new_rank rank_name;
  _caller_id uuid := auth.uid(); _caller_name text;
BEGIN
  SELECT * INTO _sub FROM mission_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _sub.status != 'pending' THEN RAISE EXCEPTION 'Not pending'; END IF;
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _mission FROM missions WHERE id = _sub.mission_id;
  _xp_amount := _mission.xp_reward;
  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;

  UPDATE mission_submissions SET status = 'approved', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id WHERE id = _submission_id;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_sub.user_id, _xp_amount, _mission.title || ' 클리어');
  UPDATE member_progress SET total_xp = total_xp + _xp_amount WHERE user_id = _sub.user_id;

  -- Grant gems (+5)
  PERFORM grant_gems(_sub.user_id, 5, _mission.title || ' 클리어 보상');

  SELECT * INTO _progress FROM member_progress WHERE user_id = _sub.user_id;
  SELECT * INTO _level FROM levels WHERE rank_name = _progress.current_rank AND level_number = _progress.current_level;

  IF _level IS NOT NULL AND _progress.total_xp >= _level.xp_required THEN
    IF _progress.current_level < 10 THEN
      _new_level := _progress.current_level + 1; _new_rank := _progress.current_rank; _leveled_up := true;
      UPDATE member_progress SET current_level = _new_level WHERE user_id = _sub.user_id;
    END IF;
  END IF;

  PERFORM create_notification(_sub.user_id,
    COALESCE(_caller_name, '관장님') || '님이 ' || _mission.title || ' 완료를 승인했습니다',
    'XP +' || _xp_amount || ', 💎 +5 획득!');

  RETURN jsonb_build_object('xp_granted', _xp_amount, 'gems_granted', 5, 'leveled_up', _leveled_up, 'ranked_up', _ranked_up,
    'new_level', COALESCE(_new_level, _progress.current_level),
    'new_rank', COALESCE(_new_rank, _progress.current_rank)::text,
    'total_xp', _progress.total_xp + _xp_amount);
END;
$$;

-- approve_quest_submission: +3/5/10/50 gems based on type
CREATE OR REPLACE FUNCTION public.approve_quest_submission(_submission_id uuid, _coach_note text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub record; _quest record; _xp_amount int; _progress record; _level record;
  _leveled_up boolean := false; _ranked_up boolean := false;
  _new_level int; _new_rank rank_name;
  _caller_id uuid := auth.uid(); _caller_name text;
  _gem_amount int;
BEGIN
  SELECT * INTO _sub FROM quest_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _sub.status::text != 'pending' THEN RAISE EXCEPTION 'Not pending'; END IF;
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _sub.user_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _quest FROM quests WHERE id = _sub.quest_id;
  _xp_amount := COALESCE(NULLIF(_quest.xp_reward, 0), get_quest_xp(_quest.quest_type));
  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;

  -- Determine gem amount by quest type
  _gem_amount := CASE _quest.quest_type
    WHEN 'main' THEN 3
    WHEN 'sub' THEN 5
    WHEN 'weekly' THEN 10
    WHEN 'boss' THEN 50
    ELSE 3
  END;

  UPDATE quest_submissions SET status = 'approved', coach_note = _coach_note, reviewed_at = now(), reviewed_by = _caller_id WHERE id = _submission_id;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_sub.user_id, _xp_amount, _quest.title || ' 완료');
  UPDATE member_progress SET total_xp = total_xp + _xp_amount WHERE user_id = _sub.user_id;
  IF _quest.quest_type = 'boss' THEN UPDATE member_progress SET bosses_cleared = bosses_cleared + 1 WHERE user_id = _sub.user_id; END IF;

  -- Grant gems
  PERFORM grant_gems(_sub.user_id, _gem_amount, _quest.title || ' 완료 보상');

  SELECT * INTO _progress FROM member_progress WHERE user_id = _sub.user_id;
  SELECT * INTO _level FROM levels WHERE rank_name = _progress.current_rank AND level_number = _progress.current_level;
  IF _level IS NOT NULL AND _progress.total_xp >= _level.xp_required THEN
    IF _progress.current_level < 10 THEN
      _new_level := _progress.current_level + 1; _new_rank := _progress.current_rank; _leveled_up := true;
      UPDATE member_progress SET current_level = _new_level WHERE user_id = _sub.user_id;
    END IF;
  END IF;

  PERFORM create_notification(_sub.user_id,
    COALESCE(_caller_name, '관장님') || '님이 ' || _quest.title || ' 완료를 승인했습니다', 'XP +' || _xp_amount || ', 💎 +' || _gem_amount || ' 획득!');

  RETURN jsonb_build_object('xp_granted', _xp_amount, 'gems_granted', _gem_amount, 'leveled_up', _leveled_up, 'ranked_up', _ranked_up,
    'new_level', COALESCE(_new_level, _progress.current_level),
    'new_rank', COALESCE(_new_rank, _progress.current_rank)::text,
    'total_xp', _progress.total_xp + _xp_amount);
END;
$$;

-- record_attendance: +2 gems
CREATE OR REPLACE FUNCTION public.record_attendance(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (
    SELECT 1 FROM xp_logs
    WHERE user_id = _user_id AND reason = '출석 체크' AND created_at::date = CURRENT_DATE
  ) THEN
    RETURN;
  END IF;

  INSERT INTO xp_logs (user_id, amount, reason)
  VALUES (_user_id, 10, '출석 체크');

  UPDATE member_progress
  SET total_xp = total_xp + 10, streak_days = streak_days + 1
  WHERE user_id = _user_id;

  -- Grant gems (+2)
  PERFORM grant_gems(_user_id, 2, '출석 체크 보상');
END;
$$;

-- pass_boss_battle: +50 gems
CREATE OR REPLACE FUNCTION public.pass_boss_battle(_member_id uuid, _coach_note text DEFAULT '타이틀매치 합격'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid(); _progress record; _next_rank rank_name;
  _rank_order text[] := ARRAY['white','blue','red','black']; _current_idx int; _caller_name text;
BEGIN
  IF NOT (has_role(_caller_id, 'super_admin') OR is_branch_manager_of(_caller_id, _member_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _progress FROM member_progress WHERE user_id = _member_id;
  IF _progress.current_level != 10 THEN RAISE EXCEPTION 'Member is not at level 10'; END IF;
  SELECT nickname INTO _caller_name FROM profiles WHERE user_id = _caller_id;

  _current_idx := array_position(_rank_order, _progress.current_rank::text);

  INSERT INTO level_status (user_id, rank_name, level_number, status, completed_at, approved_by, approval_note)
  VALUES (_member_id, _progress.current_rank, 10, 'boss_cleared', now(), _caller_id, _coach_note)
  ON CONFLICT (user_id, rank_name, level_number)
  DO UPDATE SET status = 'boss_cleared', completed_at = now(), approved_by = _caller_id, approval_note = _coach_note;

  -- Grant gems (+50)
  PERFORM grant_gems(_member_id, 50, _progress.current_rank::text || ' 타이틀매치 클리어 보상');

  IF _current_idx IS NULL OR _current_idx >= 4 THEN
    UPDATE member_progress SET bosses_cleared = bosses_cleared + 1 WHERE user_id = _member_id;
    PERFORM create_notification(_member_id, '보스전 합격! 축하합니다! 🏆 💎 +50', '');
    RETURN jsonb_build_object('ranked_up', false, 'new_rank', _progress.current_rank::text, 'new_level', 10, 'gems_granted', 50);
  END IF;

  _next_rank := _rank_order[_current_idx + 1]::rank_name;
  UPDATE member_progress SET current_rank = _next_rank, current_level = 1, bosses_cleared = bosses_cleared + 1 WHERE user_id = _member_id;
  INSERT INTO xp_logs (user_id, amount, reason) VALUES (_member_id, 100, _progress.current_rank::text || ' 타이틀매치 클리어');
  UPDATE member_progress SET total_xp = total_xp + 100 WHERE user_id = _member_id;

  INSERT INTO level_status (user_id, rank_name, level_number, status)
  VALUES (_member_id, _next_rank, 1, 'in_progress')
  ON CONFLICT (user_id, rank_name, level_number) DO UPDATE SET status = 'in_progress';

  PERFORM create_notification(_member_id,
    '축하합니다! ' || CASE _next_rank WHEN 'blue' THEN '블루' WHEN 'red' THEN '레드' WHEN 'black' THEN '블랙' ELSE _next_rank::text END || ' 레벨 1이 해금되었습니다! 🎉 💎 +50', '');

  RETURN jsonb_build_object('ranked_up', true, 'new_rank', _next_rank::text, 'new_level', 1, 'gems_granted', 50);
END;
$$;

-- =============================================
-- 13. Seed data: categories + default gloves
-- =============================================
INSERT INTO public.avatar_item_categories (code, name, sort_order) VALUES
  ('gloves', '글러브', 1),
  ('hair', '헤어', 2),
  ('top', '상의', 3),
  ('bottom', '하의', 4),
  ('shoes', '신발', 5),
  ('accessory', '액세서리', 6);

INSERT INTO public.avatar_items (category_code, name, description, rarity, price_gems, is_default, league_requirement, sort_order) VALUES
  ('gloves', '화이트 기본 글러브', '깨끗한 흰색 글러브', 'common', 0, true, NULL, 1),
  ('gloves', '블루 글러브', '시원한 블루 컬러 글러브', 'uncommon', 30, false, 'blue', 2),
  ('gloves', '레드 글러브', '강렬한 레드 컬러 글러브', 'rare', 80, false, 'red', 3),
  ('gloves', '블랙 챔피언 글러브', '최강의 블랙 글러브', 'legendary', 200, false, 'black', 4);
