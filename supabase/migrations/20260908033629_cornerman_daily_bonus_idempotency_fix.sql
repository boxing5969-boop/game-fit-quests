-- [발견] claim_cornerman_daily_bonus — 멱등키에 pair_id 가 들어 있었다. (2026-09-08 풀파워 검수)
--        코너맨 짝을 끊고 다시 맺으면 같은 날 보너스를 무한히 받을 수 있었다.
--        게다가 grant_gems 가 이벤트 삽입 성공 여부와 무관하게 호출돼,
--        멱등키가 걸려도 젬은 계속 나갔다.
-- [조치] 멱등키를 (날짜, 사람) 으로 바꾸고, 실제로 이벤트가 새로 들어간
--        사람에게만 젬·XP·리스펙트를 지급한다.
create or replace function public.claim_cornerman_daily_bonus()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pair public.boxing_cornerman_pairs%ROWTYPE;
  v_partner_id uuid;
  v_kst_date date;
  v_my_completed boolean;
  v_partner_completed boolean;
  v_xp integer := 50;
  v_gems integer := 100;
  v_respect integer := 10;
  v_idem text;
  v_sync_id uuid;
  v_ins_me int := 0;
  v_ins_partner int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- 검증 1: active pair
  SELECT * INTO v_pair
  FROM public.boxing_cornerman_pairs
  WHERE status = 'active'
    AND (requester_user_id = v_uid OR receiver_user_id = v_uid)
  ORDER BY accepted_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND OR v_pair.id IS NULL THEN
    RAISE EXCEPTION 'cornerman bonus not eligible';
  END IF;

  IF v_pair.requester_user_id = v_uid THEN
    v_partner_id := v_pair.receiver_user_id;
  ELSE
    v_partner_id := v_pair.requester_user_id;
  END IF;

  v_kst_date := (now() AT TIME ZONE 'Asia/Seoul')::date;

  -- 검증 2: 오늘 둘 다 진짜 활동
  v_my_completed := public.boxing_cornerman_user_completed_today(v_uid);
  v_partner_completed := public.boxing_cornerman_user_completed_today(v_partner_id);

  IF NOT (v_my_completed AND v_partner_completed) THEN
    RAISE EXCEPTION 'cornerman bonus not eligible';
  END IF;

  -- 검증 3: 오늘 이미 받았는지 — 짝이 아니라 "사람+날짜" 기준.
  -- 짝을 끊고 새로 맺어도 같은 날 두 번은 못 받는다.
  IF EXISTS (
    SELECT 1 FROM public.boxing_engagement_events
     WHERE user_id = v_uid
       AND idempotency_key = concat('cornerman_bonus:', v_kst_date::text, ':', v_uid::text)
  ) THEN
    RAISE EXCEPTION 'cornerman bonus already claimed';
  END IF;

  PERFORM public.ensure_boxing_engagement_profile(v_uid);
  PERFORM public.ensure_boxing_engagement_profile(v_partner_id);

  -- daily_syncs upsert (짝 단위 기록은 그대로 유지 — 화면·통계용)
  INSERT INTO public.boxing_cornerman_daily_syncs (
    pair_id, user_a_id, user_b_id, sync_date,
    user_a_completed, user_b_completed, bonus_claimed,
    quest_xp_granted, gems_granted, respect_granted
  ) VALUES (
    v_pair.id, v_pair.requester_user_id, v_pair.receiver_user_id, v_kst_date,
    true, true, true, v_xp, v_gems, v_respect
  )
  ON CONFLICT (pair_id, sync_date) DO UPDATE
    SET user_a_completed = true, user_b_completed = true, bonus_claimed = true,
        quest_xp_granted = EXCLUDED.quest_xp_granted,
        gems_granted = EXCLUDED.gems_granted,
        respect_granted = EXCLUDED.respect_granted
  RETURNING id INTO v_sync_id;

  -- 본인 — 멱등키에서 pair_id 제거
  v_idem := concat('cornerman_bonus:', v_kst_date::text, ':', v_uid::text);
  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_uid, 'reward', 'boxing_cornerman', v_pair.id, 'cornerman_bonus_claimed',
    v_xp, v_gems, v_respect, v_idem,
    jsonb_build_object('pair_id', v_pair.id, 'partner_id', v_partner_id)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_ins_me = ROW_COUNT;

  -- 파트너
  v_idem := concat('cornerman_bonus:', v_kst_date::text, ':', v_partner_id::text);
  INSERT INTO public.boxing_engagement_events (
    user_id, event_type, source_type, source_id, action,
    quest_xp_delta, gems_delta, respect_delta, idempotency_key, metadata
  ) VALUES (
    v_partner_id, 'reward', 'boxing_cornerman', v_pair.id, 'cornerman_bonus_claimed',
    v_xp, v_gems, v_respect, v_idem,
    jsonb_build_object('pair_id', v_pair.id, 'partner_id', v_uid)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_ins_partner = ROW_COUNT;

  -- 지급은 "이벤트가 실제로 새로 들어간 사람"에게만.
  -- 예전엔 이 가드가 없어 멱등키가 걸려도 젬이 계속 나갔다.
  IF v_ins_me > 0 THEN
    UPDATE public.boxing_engagement_profiles
       SET quest_xp = quest_xp + v_xp, respect_points = respect_points + v_respect
     WHERE user_id = v_uid;
    IF v_gems > 0 THEN PERFORM public.grant_gems(v_uid, v_gems, '코너맨 일일 보너스'); END IF;
  END IF;

  IF v_ins_partner > 0 THEN
    UPDATE public.boxing_engagement_profiles
       SET quest_xp = quest_xp + v_xp, respect_points = respect_points + v_respect
     WHERE user_id = v_partner_id;
    IF v_gems > 0 THEN PERFORM public.grant_gems(v_partner_id, v_gems, '코너맨 일일 보너스'); END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pair_id', v_pair.id,
    'sync_id', v_sync_id,
    'quest_xp_granted', CASE WHEN v_ins_me > 0 THEN v_xp ELSE 0 END,
    'gems_granted',     CASE WHEN v_ins_me > 0 THEN v_gems ELSE 0 END,
    'respect_granted',  CASE WHEN v_ins_me > 0 THEN v_respect ELSE 0 END,
    'partner_granted',  (v_ins_partner > 0),
    'message', '코너맨 일일 보너스를 받았습니다. 둘 다 오늘 라운드를 클리어했습니다.'
  );
END;
$function$;
