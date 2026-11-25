-- 코치님 · 지점장님 캐릭터 꾸미기 무제한 (2026-11-25 대표님 「코치님들은 아바타 무제한으로 꾸밀수있도록 챔피언머니무제한으로 주자」 → 「다음가자」)
--
-- 잔액에 큰 숫자를 넣지 않고, 관리자에게만 있던 '무료 통과'를 지도진까지 넓힌다.
--   지도진 = 앱 권한 admin · super_admin · coach · branch_manager 이거나 profiles.is_staff = true
-- 바뀌는 곳 세 군데 (모두 운영 지금 정의 위에서 그 줄만):
--   purchase_customization            — 레벨 제한 · 지갑 차감 건너뜀 (명예의 전당 아이템은 예전처럼 관리자만 통과)
--   save_member_customization         — 저장할 때 레벨 제한 건너뜀
--   character_presets_validate_unlocks — 저장 트리거의 레벨 검사 건너뜀
-- 지갑 · 챔피언 머니 잔액 · 다른 함수는 그대로. 줄을 지우는 문장 없음.

create or replace function public._customize_free(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _uid is not null and (
    exists (select 1 from public.user_roles r
             where r.user_id = _uid
               and r.role in ('admin', 'super_admin', 'coach', 'branch_manager'))
    or exists (select 1 from public.profiles p
                where p.user_id = _uid and coalesce(p.is_staff, false))
  );
$$;
revoke all on function public._customize_free(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.purchase_customization(p_category text, p_item_key text, p_price integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  UUID := auth.uid();
  v_balance  INTEGER;
  v_already  BOOLEAN;
  v_required INTEGER;
  v_level    INTEGER;
  v_is_admin BOOLEAN;
  v_free     BOOLEAN;
  v_price    INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- 서버 가격표가 유일한 진실. 클라이언트가 보낸 p_price 는 버린다.
  v_price := public.get_customization_price(p_category, p_item_key);
  IF v_price IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unknown_item',
                             'category', p_category, 'item_key', p_item_key);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_roles
     WHERE user_id = v_user_id AND role IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  -- 지도진(코치님 · 지점장님) 은 관리자처럼 무료 · 레벨 제한 없음 (2026-11-25)
  v_free := v_is_admin OR public._customize_free(v_user_id);

  SELECT EXISTS(
    SELECT 1 FROM user_owned_customizations
     WHERE user_id = v_user_id AND category = p_category AND item_key = p_item_key
  ) INTO v_already;

  IF v_already THEN
    RETURN json_build_object('success', true, 'already_owned', true);
  END IF;

  -- HoF 게이트 — 관리자만 우회 (지도진도 막음 — 전시 의미 유지).
  IF public.is_hof_required_item(p_category, p_item_key)
     AND NOT public.is_caller_in_hall_of_fame()
     AND NOT v_is_admin
  THEN
    RETURN json_build_object('success', false, 'error', 'hof_required',
                             'category', p_category, 'item_key', p_item_key);
  END IF;

  -- 레벨 게이트 — 관리자 · 지도진은 우회. 회원은 기존 로직 유지.
  IF NOT v_free THEN
    v_required := public.get_customization_required_level(p_category, p_item_key);
    IF v_required IS NOT NULL THEN
      v_level := public.get_caller_user_level();
      IF v_level < v_required THEN
        RETURN json_build_object('success', false, 'error', 'level_locked',
                                 'required_level', v_required, 'current_level', v_level);
      END IF;
    END IF;
  END IF;

  -- 지갑 잔액 체크 & 차감 — 관리자 · 지도진은 전 구간 스킵.
  -- FOR UPDATE: 같은 회원이 동시에 두 번 눌러 잔액을 두 번 쓰는 경합을 막는다.
  IF NOT v_free THEN
    SELECT gems_balance INTO v_balance
      FROM user_wallets WHERE user_id = v_user_id FOR UPDATE;
    IF v_balance IS NULL THEN v_balance := 0; END IF;

    IF v_price > 0 AND v_balance < v_price THEN
      RETURN json_build_object('success', false, 'error', 'insufficient_gems', 'current', v_balance);
    END IF;

    IF v_price > 0 THEN
      UPDATE user_wallets
         SET gems_balance = gems_balance - v_price,
             total_spent  = total_spent + v_price
       WHERE user_id = v_user_id;

      INSERT INTO wallet_transactions (user_id, amount, reason, meta_json)
      VALUES (v_user_id, -v_price, 'customization_purchase',
              jsonb_build_object('category', p_category, 'item_key', p_item_key, 'server_price', v_price));
    END IF;
  END IF;

  INSERT INTO user_owned_customizations (user_id, category, item_key)
  VALUES (v_user_id, p_category, p_item_key);

  RETURN json_build_object(
    'success', true,
    'price', v_price,
    'remaining_gems',
      CASE WHEN v_free THEN NULL ELSE GREATEST(COALESCE(v_balance, 0) - v_price, 0) END,
    'admin_bypass', v_free
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_member_customization(_style text, _customization jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id    uuid := auth.uid();
  v_is_admin   boolean;
  v_level      int;
  v_cat        text;
  v_key        text;
  v_required   int;
  v_preset_id  uuid;
  v_parts_json jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = v_user_id AND role IN ('admin', 'super_admin')
  ) OR public._customize_free(v_user_id) INTO v_is_admin;  -- 지도진도 레벨 제한 없음 (2026-11-25)

  IF NOT v_is_admin AND _customization IS NOT NULL
     AND jsonb_typeof(_customization) = 'object' THEN
    v_level := public.get_caller_user_level();

    FOR v_cat, v_key IN SELECT * FROM jsonb_each_text(_customization) LOOP
      IF v_key IS NULL OR v_key = '' OR v_key = 'none' THEN CONTINUE; END IF;
      v_required := public.get_customization_required_level(v_cat, v_key);
      IF v_required IS NOT NULL AND v_level < v_required THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'level_locked',
          'category', v_cat,
          'item_key', v_key,
          'required_level', v_required,
          'current_level', v_level
        );
      END IF;
    END LOOP;
  END IF;

  v_parts_json := jsonb_build_object(
    'style', _style,
    'customization', COALESCE(_customization, '{}'::jsonb)
  );

  -- 개인 프리셋 upsert (created_by + is_template=false 조합이 개인 슬롯)
  SELECT id INTO v_preset_id
    FROM character_presets
   WHERE created_by = v_user_id AND is_template = false
   ORDER BY updated_at DESC
   LIMIT 1;

  IF v_preset_id IS NOT NULL THEN
    UPDATE character_presets
       SET parts_json = v_parts_json,
           updated_at = now()
     WHERE id = v_preset_id;
  ELSE
    INSERT INTO character_presets (name, parts_json, created_by, is_template)
    VALUES (v_user_id::text || '_custom', v_parts_json, v_user_id, false)
    RETURNING id INTO v_preset_id;
  END IF;

  -- 할당 upsert
  INSERT INTO member_character_assignments (user_id, preset_id, is_active, display_mode)
  VALUES (v_user_id, v_preset_id, true, 'sprite')
  ON CONFLICT (user_id) DO UPDATE
    SET preset_id    = EXCLUDED.preset_id,
        is_active    = true,
        display_mode = 'sprite';

  RETURN jsonb_build_object(
    'success', true,
    'preset_id', v_preset_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.character_presets_validate_unlocks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cat      text;
  v_key      text;
  v_required int;
  v_level    int;
  v_bypass   boolean;
  v_is_hof   boolean;
  v_rank     rank_name;
  v_tier_lvl int;
  v_bosses   int;
BEGIN
  -- 템플릿 프리셋(관리자가 만드는 공식 프리셋) 은 검증 생략
  IF NEW.is_template THEN RETURN NEW; END IF;
  IF NEW.parts_json IS NULL THEN RETURN NEW; END IF;
  IF NEW.parts_json->'customization' IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(NEW.parts_json->'customization') <> 'object' THEN RETURN NEW; END IF;

  -- 관리자/슈퍼관리자 · 지도진(코치님 · 지점장님, 2026-11-25) 은 우회 허용 (프론트 isAdmin 과 동일)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
     WHERE user_id = NEW.created_by
       AND role IN ('admin', 'super_admin')
  ) OR public._customize_free(NEW.created_by) INTO v_bypass;
  IF v_bypass THEN RETURN NEW; END IF;

  -- 대상 유저의 computeUserLevel 산출 (get_caller_user_level 은
  -- auth.uid() 에 묶여 있어 트리거 맥락에서 부정확할 수 있으므로
  -- created_by 기준으로 직접 재계산).
  SELECT mp.current_rank, mp.current_level, COALESCE(mp.bosses_cleared, 0)
    INTO v_rank, v_tier_lvl, v_bosses
    FROM member_progress mp
   WHERE mp.user_id = NEW.created_by;

  IF v_rank IS NULL THEN
    v_level := 1;
  ELSE
    v_is_hof := v_rank = 'black' AND v_tier_lvl = 10 AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
       WHERE ur.user_id = NEW.created_by
         AND ur.role IN ('super_admin', 'admin', 'branch_manager')
    );

    IF v_is_hof THEN
      v_level := 99;
    ELSIF v_rank = 'black' AND v_tier_lvl = 10 AND v_bosses >= 4 THEN
      v_level := 50;
    ELSE
      v_level := CASE v_rank
        WHEN 'white' THEN 0
        WHEN 'blue'  THEN 10
        WHEN 'red'   THEN 20
        WHEN 'black' THEN 30
        ELSE 0
      END + COALESCE(v_tier_lvl, 1);
    END IF;
  END IF;

  -- customization JSON 의 각 (category, itemKey) 검증
  FOR v_cat, v_key IN SELECT * FROM jsonb_each_text(NEW.parts_json->'customization') LOOP
    IF v_key IS NULL OR v_key = '' OR v_key = 'none' THEN CONTINUE; END IF;
    v_required := public.get_customization_required_level(v_cat, v_key);
    IF v_required IS NOT NULL AND v_level < v_required THEN
      RAISE EXCEPTION
        'level_locked: item % (category %) requires level %, user has %',
        v_key, v_cat, v_required, v_level
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
